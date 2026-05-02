/**
 * MarginTracker — subscribes to ticks and scans positions for liquidation.
 *
 * On each tick for symbol S:
 *   1. SCAN account:*:positions:{S} in batches of 100
 *   2. For each position hash, compute marginRatio
 *   3. If marginRatio >= 1.0, LPUSH to liquidation:queue
 */

import { redis, KEYS } from '../../lib/redis';
import { computeMarginRatio, MAINTENANCE_MARGIN_RATE } from './margin-math';
import type { Tick } from '../../types/index';

export class MarginTracker {
    private isRunning = false;
    private scanBatchSize = 100;

    start(): void {
        this.isRunning = true;
        console.log('[MarginTracker] started');
    }

    stop(): void {
        this.isRunning = false;
        console.log('[MarginTracker] stopped');
    }

    /**
     * Called on each tick — scans all positions for this symbol
     * and enqueues any that breach maintenance margin.
     */
    async onTick(tick: Tick): Promise<void> {
        if (!this.isRunning) return;

        const markPrice = parseFloat(tick.mid);
        if (markPrice <= 0) return;

        const pattern = KEYS.positionPattern(tick.symbol);

        try {
            await this.scanPositions(pattern, tick.symbol, markPrice);
        } catch (err) {
            console.error(`[MarginTracker] scan error for ${tick.symbol}:`, err);
        }
    }

    /**
     * Iterative SCAN — processes positions in batches of 100 keys.
     * Never loads all accounts into memory at once.
     */
    private async scanPositions(
        pattern: string,
        symbol: string,
        markPrice: number,
    ): Promise<void> {
        let cursor = '0';

        do {
            // SCAN returns [nextCursor, [key1, key2, ...]]
            const [nextCursor, keys] = await redis.scan(
                cursor,
                'MATCH', pattern,
                'COUNT', this.scanBatchSize,
            );
            cursor = nextCursor;

            if (keys.length === 0) continue;

            // Pipeline HGETALL for all matched keys (efficient batch read)
            const pipeline = redis.pipeline();
            for (const key of keys) {
                pipeline.hgetall(key);
            }
            const results = await pipeline.exec();
            if (!results) continue;

            for (let i = 0; i < keys.length; i++) {
                const [err, posData] = results[i];
                if (err || !posData || typeof posData !== 'object') continue;

                const data = posData as Record<string, string>;
                if (!data.size || !data.isolatedMargin) continue;

                const size = Math.abs(parseFloat(data.size));
                const isolatedMargin = parseFloat(data.isolatedMargin);

                if (size <= 0 || isolatedMargin <= 0) continue;

                // Compute position value at current mark price
                const positionValue = size * markPrice;
                const marginRatio = computeMarginRatio(
                    positionValue,
                    isolatedMargin,
                    MAINTENANCE_MARGIN_RATE,
                );

                if (marginRatio >= 1.0) {
                    // Extract UID from key: account:{uid}:positions:{symbol}
                    const uid = this.extractUid(keys[i]);
                    if (!uid) continue;

                    // Enqueue for liquidation
                    await redis.lpush(
                        KEYS.liquidationQueue,
                        `${uid}:${symbol}`,
                    );
                    console.log(
                        `[MarginTracker] ⚠ LIQUIDATION ALERT: ${uid} ${symbol} ` +
                        `marginRatio=${marginRatio.toFixed(4)} (>= 1.0)`,
                    );
                }
            }
        } while (cursor !== '0');
    }

    /**
     * Extract UID from Redis key: account:{uid}:positions:{symbol}
     */
    private extractUid(key: string): string | null {
        const match = key.match(/^account:(.+?):positions:/);
        return match ? match[1] : null;
    }
}
