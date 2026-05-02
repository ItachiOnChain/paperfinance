/**
 * LiquidationExecutor — BRPOP worker that processes liquidation queue.
 *
 * Polls liquidation:queue with 1s blocking timeout.
 * For each item: validates price, computes PnL, executes Lua script.
 */

import { uuidv7 } from 'uuidv7';
import { redis, KEYS } from '../../lib/redis';
import { computeLiquidationPnl, LIQUIDATION_FEE_RATE } from './margin-math';
import { getValidatedPrice } from '../market-data/oracle-validator';
import { normalizeAddress } from '../../lib/normalizeAddress';
import type { EvmAddress } from '../../lib/normalizeAddress';
import type { Fill } from '../../types/index';

export class LiquidationExecutor {
    private isRunning = false;

    async start(): Promise<void> {
        this.isRunning = true;
        console.log('[LiquidationExecutor] started — polling liquidation:queue');
        this.pollLoop();
    }

    stop(): void {
        this.isRunning = false;
        console.log('[LiquidationExecutor] stopped');
    }

    /**
     * Main poll loop — BRPOP with 1s timeout, process items one at a time.
     */
    private async pollLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                // BRPOP returns [key, value] or null on timeout
                const result = await redis.brpop(KEYS.liquidationQueue, 1);
                if (!result) continue; // timeout, loop again

                const [, item] = result; // item = "uid:symbol"
                const separatorIdx = item.indexOf(':');
                if (separatorIdx === -1) {
                    console.error('[LiquidationExecutor] malformed queue item:', item);
                    continue;
                }

                const uid = normalizeAddress(item.substring(0, separatorIdx));
                const symbol = item.substring(separatorIdx + 1);

                await this.executeLiquidation(uid, symbol);
            } catch (err) {
                console.error('[LiquidationExecutor] poll error:', err);
                // Brief pause to avoid tight error loops
                await new Promise((r) => setTimeout(r, 500));
            }
        }
    }

    /**
     * Execute a single liquidation for uid:symbol.
     */
    private async executeLiquidation(uid: EvmAddress, symbol: string): Promise<void> {
        // 1. Read position data
        const posData = await redis.hgetall(KEYS.position(uid, symbol));
        if (!posData || !posData.size || parseFloat(posData.size) === 0) {
            console.warn(`[LiquidationExecutor] no position for ${uid}:${symbol} — skipping`);
            return;
        }

        const size = Math.abs(parseFloat(posData.size));
        const side = posData.side as 'long' | 'short';
        const avgEntry = parseFloat(posData.entryPrice || '0');
        const liqPrice = parseFloat(posData.liquidationPrice || '0');

        // 2. Get validated mark price
        let markPrice: number;
        try {
            markPrice = await getValidatedPrice(symbol);
        } catch (err) {
            console.error(`[LiquidationExecutor] price validation failed for ${symbol}:`, err);
            // Re-enqueue for retry
            await redis.lpush(KEYS.liquidationQueue, `${uid}:${symbol}`);
            return;
        }

        // 3. Verify liquidation is still warranted at current price
        const shouldLiquidate = side === 'long'
            ? markPrice <= liqPrice
            : markPrice >= liqPrice;

        if (!shouldLiquidate) {
            console.log(`[LiquidationExecutor] ${uid}:${symbol} recovered — mark=${markPrice} liq=${liqPrice}`);
            return;
        }

        // 4. Compute final PnL
        const finalPnl = computeLiquidationPnl(side, size, avgEntry, liqPrice, LIQUIDATION_FEE_RATE);
        const fee = size * liqPrice * LIQUIDATION_FEE_RATE;

        // 5. Build fill event
        const fill: Fill = {
            id: uuidv7(),
            orderId: 'LIQUIDATION',
            uid,
            symbol,
            side: side === 'long' ? 'sell' : 'buy', // Closing side
            size: size.toFixed(8),
            price: liqPrice.toFixed(8),
            fee: fee.toFixed(8),
            realizedPnl: finalPnl.toFixed(8),
            positionBefore: posData.size,
            positionAfter: '0',
            timestamp: Date.now(),
        };

        const fillJson = JSON.stringify(fill);
        const now = Date.now().toString();

        // 6. Execute atomic Lua liquidation
        await redis.liquidatePosition(
            KEYS.balance(uid),
            KEYS.position(uid, symbol),
            KEYS.openOrders(uid),
            KEYS.fills(uid),
            uid,
            symbol,
            side,
            size.toFixed(8),
            liqPrice.toFixed(8),
            finalPnl.toFixed(8),
            fee.toFixed(8),
            fillJson,
            now,
        );

        console.log(
            `[LIQUIDATION] ❌ ${uid} ${side.toUpperCase()} ${size.toFixed(4)} ${symbol} ` +
            `@ ${liqPrice.toFixed(2)} | pnl=${finalPnl.toFixed(4)} fee=${fee.toFixed(4)}`,
        );
    }
}
