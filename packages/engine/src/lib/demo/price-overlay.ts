/**
 * PriceOverlay — reads live Binance prices from Redis and applies
 * temporary price shocks for demo scenarios.
 *
 * This is NOT a mock data source. All base prices come from real
 * Binance data stored in Redis by BinanceAdapter.
 */

import { redis, KEYS } from '../redis';

interface ShockState {
    symbol: string;
    offsetPct: number;
    expiresAt: number;
}

export class PriceOverlay {
    private shocks: Map<string, ShockState> = new Map();

    /**
     * Get the current price for a symbol.
     * Returns the real Binance price from Redis, with any active shocks applied.
     */
    async getPrice(symbol: string): Promise<number> {
        const raw = await redis.get(KEYS.marketMid(symbol));
        let price = raw ? parseFloat(raw) : 0;
        if (price <= 0) return 0;

        // Apply active shock
        const shock = this.shocks.get(symbol);
        if (shock && Date.now() < shock.expiresAt) {
            price *= (1 + shock.offsetPct / 100);
            // Write shocked price to Redis so engine sees it
            await redis.set(KEYS.marketMid(symbol), price.toString());
        } else if (shock) {
            this.shocks.delete(symbol);
        }

        return price;
    }

    /**
     * Apply a temporary price shock. Lasts for `durationMs` before expiring.
     * The real Binance tick will overwrite the shock on its next update.
     */
    shock(symbol: string, pctChange: number, durationMs = 5000): void {
        const existing = this.shocks.get(symbol);
        const currentOffset = existing ? existing.offsetPct : 0;
        this.shocks.set(symbol, {
            symbol,
            offsetPct: currentOffset + pctChange,
            expiresAt: Date.now() + durationMs,
        });
        console.log(`[PriceOverlay] SHOCK ${symbol}: ${pctChange > 0 ? '+' : ''}${pctChange}% (cumulative: ${currentOffset + pctChange}%)`);
    }

    /**
     * Clear all shocks.
     */
    clearShocks(): void {
        this.shocks.clear();
    }
}
