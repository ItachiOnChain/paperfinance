/**
 * MatchingEngine — core loop for the paper trading backend.
 *
 * Subscribes to ticks via the MarketDataAdapter interface,
 * scans open orders (ZRANGEBYSCORE), invokes the Lua fill script
 * for each fillable order, and publishes fill events via XADD.
 */

import { uuidv7 } from 'uuidv7';
import { redis, KEYS, connectRedis } from '../../lib/redis';
import { computeFillPrice } from './fill-math';
import type { MarketDataAdapter } from '../../adapters/market-data';
import type { Order, Fill, Tick, OrderSide } from '../../types/index';
import type { EvmAddress } from '../../lib/normalizeAddress';
import { DEFAULT_SLIPPAGE } from '../../types/index';

export class MatchingEngine {
    private adapter: MarketDataAdapter;
    private isRunning = false;
    private feeRate = 0.00035; // taker fee

    constructor(adapter: MarketDataAdapter) {
        this.adapter = adapter;
    }

    async start(): Promise<void> {
        this.isRunning = true;

        this.adapter.onTick(async (tick: Tick) => {
            if (!this.isRunning) return;
            try {
                await this.onTick(tick);
            } catch (err) {
                console.error('[MatchingEngine] tick error:', err);
            }
        });

        await this.adapter.connect();
        console.log('[MatchingEngine] started');
    }

    stop(): void {
        this.isRunning = false;
        this.adapter.disconnect();
        console.log('[MatchingEngine] stopped');
    }

    /**
     * On each tick:
     * 1. Store mid price in Redis
     * 2. Scan all users' open orders
     * 3. Fill any orders that are marketable at the current mid
     */
    private async onTick(tick: Tick): Promise<void> {
        // Update market mid price in Redis
        await redis.set(KEYS.marketMid(tick.symbol), tick.mid);

        // Scan all users: find all open order keys (orders:{address}:open)
        let cursor = '0';
        do {
            const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'orders:*:open', 'COUNT', 100);
            cursor = newCursor;
            for (const key of keys) {
                // Extract address from key: orders:{address}:open
                const match = key.match(/^orders:(0x[a-fA-F0-9]{40}):open$/);
                if (!match) continue;
                const uid = match[1] as EvmAddress;
                await this.scanAndFill(uid, tick);
            }
        } while (cursor !== '0');
    }

    private async scanAndFill(uid: EvmAddress, tick: Tick): Promise<void> {
        const openKey = KEYS.openOrders(uid);
        const mid = parseFloat(tick.mid);

        // Get all open orders with scores (prices)
        const members = await redis.zrangebyscore(openKey, '-inf', '+inf', 'WITHSCORES');

        // members = [orderId1, score1, orderId2, score2, ...]
        for (let i = 0; i < members.length; i += 2) {
            const orderId = members[i];
            const score = parseFloat(members[i + 1]);

            // Retrieve the full order data
            const orderJson = await redis.get(KEYS.orderData(orderId));
            if (!orderJson) {
                // Orphaned order in ZSET — clean it up
                await redis.zrem(openKey, orderId);
                continue;
            }

            const order: Order = JSON.parse(orderJson);
            if (order.symbol !== tick.symbol) continue;

            // Check fillability
            const shouldFill = this.shouldFill(order, mid);
            if (!shouldFill) continue;

            // Compute fill price with slippage
            const sizeUSD = parseFloat(order.size) * mid;
            const fillPrice = computeFillPrice(order.side, mid, sizeUSD, DEFAULT_SLIPPAGE);
            const fillSize = parseFloat(order.size) - parseFloat(order.filledSize);
            if (fillSize <= 0) continue;

            await this.executeFill(uid, order, fillPrice, fillSize, tick);
        }
    }

    private shouldFill(order: Order, mid: number): boolean {
        const orderPrice = parseFloat(order.price);
        if (order.type === 'market') return true;
        // Limit buy fills when mid <= limit price
        if (order.side === 'buy') return mid <= orderPrice;
        // Limit sell fills when mid >= limit price
        return mid >= orderPrice;
    }

    /**
     * Execute a fill using the atomic Lua script.
     */
    private async executeFill(
        uid: EvmAddress,
        order: Order,
        fillPrice: number,
        fillSize: number,
        tick: Tick,
    ): Promise<void> {
        const fillPriceStr = fillPrice.toFixed(8);
        const fillSizeStr = fillSize.toFixed(8);

        // Read current position
        const posData = await redis.hgetall(KEYS.position(uid, order.symbol));
        const currentSize = parseFloat(posData.size || '0');
        const currentEntryPx = parseFloat(posData.entryPrice || '0');

        // Calculate new position
        const signedFill = order.side === 'buy' ? fillSize : -fillSize;
        const newPosSize = currentSize + signedFill;

        // Calculate entry price and realized PnL
        let newEntryPx: number;
        let realizedPnl = 0;

        const isIncreasing =
            (currentSize > 0 && order.side === 'buy') ||
            (currentSize < 0 && order.side === 'sell') ||
            currentSize === 0;

        if (isIncreasing) {
            // Weighted average entry
            if (currentSize === 0) {
                newEntryPx = fillPrice;
            } else {
                const totalNotional = Math.abs(currentSize) * currentEntryPx + fillSize * fillPrice;
                const totalSize = Math.abs(currentSize) + fillSize;
                newEntryPx = totalNotional / totalSize;
            }
        } else {
            // Reducing/closing
            const closingSize = Math.min(fillSize, Math.abs(currentSize));
            if (currentSize > 0) {
                // Closing long
                realizedPnl = (fillPrice - currentEntryPx) * closingSize;
            } else {
                // Closing short
                realizedPnl = (currentEntryPx - fillPrice) * closingSize;
            }
            // If flipping, new entry is fill price for remainder
            newEntryPx = fillSize > Math.abs(currentSize) ? fillPrice : currentEntryPx;
        }

        // Calculate fee
        const fee = fillSize * fillPrice * this.feeRate;

        // Build fill event
        const fill: Fill = {
            id: uuidv7(),
            orderId: order.id,
            uid,
            symbol: order.symbol,
            side: order.side,
            size: fillSizeStr,
            price: fillPriceStr,
            fee: fee.toFixed(8),
            realizedPnl: realizedPnl.toFixed(8),
            positionBefore: currentSize.toFixed(8),
            positionAfter: newPosSize.toFixed(8),
            timestamp: Date.now(),
        };

        const now = Date.now().toString();
        const fillJson = JSON.stringify(fill);

        // Update the stored order data
        const updatedOrder: Order = {
            ...order,
            status: 'filled',
            filledSize: (parseFloat(order.filledSize) + fillSize).toFixed(8),
            avgFillPrice: fillPriceStr,
            updatedAt: Date.now(),
        };
        await redis.set(KEYS.orderData(order.id), JSON.stringify(updatedOrder));

        // Execute the atomic Lua fill script
        await redis.fillOrder(
            KEYS.balance(uid),
            KEYS.position(uid, order.symbol),
            KEYS.openOrders(uid),
            KEYS.history(uid),
            KEYS.fills(uid),
            order.id,
            fillPriceStr,
            fillSizeStr,
            order.side,
            fee.toFixed(8),
            realizedPnl.toFixed(8),
            newPosSize.toFixed(8),
            newEntryPx.toFixed(8),
            fillJson,
            parseFloat(order.price).toString(),
            now,
        );

        console.log(
            `[Fill] ${order.side.toUpperCase()} ${fillSizeStr} ${order.symbol} @ ${fillPriceStr}` +
            ` | pnl=${realizedPnl.toFixed(4)} fee=${fee.toFixed(4)} pos=${newPosSize.toFixed(4)}`,
        );
    }

    // ── Public helpers for placing orders ────────────────────
    async placeOrder(uid: EvmAddress, params: {
        symbol: string;
        side: OrderSide;
        type: 'market' | 'limit';
        size: string;
        price: string;
    }): Promise<Order> {
        const order: Order = {
            id: uuidv7(),
            uid,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            size: params.size,
            price: params.price,
            status: 'open',
            filledSize: '0',
            avgFillPrice: '0',
            reduceOnly: false,
            timeInForce: params.type === 'market' ? 'IOC' : 'GTC',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // Store order data
        await redis.set(KEYS.orderData(order.id), JSON.stringify(order));

        // Add to open orders ZSET (scored by price for ZRANGEBYSCORE)
        const score = parseFloat(params.price);
        await redis.zadd(KEYS.openOrders(uid), score, order.id);

        console.log(`[Order] ${order.side} ${order.size} ${order.symbol} @ ${order.price} id=${order.id}`);
        return order;
    }

    async ensureAccount(uid: EvmAddress, balance: string = '100000'): Promise<void> {
        const exists = await redis.exists(KEYS.balance(uid));
        if (!exists) {
            await redis.set(KEYS.balance(uid), balance);
        }
    }
}
