/**
 * StalePriceGuard — middleware that wraps the matching engine's
 * tick handler.
 *
 * If time since last tick for a symbol > STALE_THRESHOLD_MS (10s):
 *   - SET stale:{symbol} 1 EX 60 in Redis
 *   - Skip fill evaluation, log warning
 *
 * When fresh ticks resume:
 *   - DEL stale:{symbol}
 *   - Resume normal execution
 */

import { redis } from '../../lib/redis';
import type { Tick } from '../../types/index';

const DEFAULT_STALE_THRESHOLD_MS = 10_000; // 10 seconds
const STALE_KEY_TTL = 60; // seconds

const STALE_KEY = (symbol: string) => `stale:${symbol}`;

export class StalePriceGuard {
    private lastTickTime = new Map<string, number>();
    private staleSymbols = new Set<string>();
    private thresholdMs: number;

    constructor(thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS) {
        this.thresholdMs = thresholdMs;
    }

    /**
     * Wraps a tick handler with staleness detection.
     *
     * @param handler  The original tick handler (matching engine's onTick)
     * @returns        A wrapped handler that guards against stale prices
     */
    wrap(handler: (tick: Tick) => void | Promise<void>): (tick: Tick) => Promise<void> {
        return async (tick: Tick) => {
            const now = Date.now();
            const symbol = tick.symbol;
            const lastTime = this.lastTickTime.get(symbol);

            // Check if this symbol was stale and is now fresh
            if (this.staleSymbols.has(symbol)) {
                console.log(`[StalePriceGuard] Fresh tick for ${symbol} — resuming execution`);
                this.staleSymbols.delete(symbol);
                // Clear the Redis flag
                await redis.del(STALE_KEY(symbol)).catch(() => { });
            }

            // Update last tick time
            this.lastTickTime.set(symbol, now);

            // Pass through to the real handler
            await handler(tick);
        };
    }

    /**
     * Check all tracked symbols for staleness.
     * Call this periodically (e.g. every second) from a timer.
     */
    async checkStaleness(): Promise<void> {
        const now = Date.now();

        for (const [symbol, lastTime] of this.lastTickTime) {
            const elapsed = now - lastTime;

            if (elapsed > this.thresholdMs && !this.staleSymbols.has(symbol)) {
                // Mark as stale
                this.staleSymbols.add(symbol);
                console.warn(
                    `[StalePriceGuard] ${symbol} stale — no tick for ${(elapsed / 1000).toFixed(1)}s ` +
                    `(threshold: ${this.thresholdMs / 1000}s)`,
                );
                // Set Redis flag
                await redis.set(STALE_KEY(symbol), '1', 'EX', STALE_KEY_TTL).catch(() => { });
            }
        }
    }

    /**
     * Check if a symbol is currently stale.
     * Used by the matching engine to skip fill evaluation.
     */
    isStale(symbol: string): boolean {
        return this.staleSymbols.has(symbol);
    }

    /**
     * Start a periodic staleness check interval.
     * @returns cleanup function to stop the interval
     */
    startMonitor(intervalMs: number = 1000): () => void {
        const timer = setInterval(() => {
            this.checkStaleness().catch((err) => {
                console.error('[StalePriceGuard] check error:', err);
            });
        }, intervalMs);

        return () => clearInterval(timer);
    }

    /**
     * Read stale status from Redis (for external consumers).
     */
    static async isSymbolStale(symbol: string): Promise<boolean> {
        const val = await redis.get(STALE_KEY(symbol));
        return val === '1';
    }
}
