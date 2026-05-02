/**
 * MockMarketDataAdapter — emits synthetic ticks for testing.
 * Useful for unit/integration tests and local dev without Binance.
 */

import type { Tick } from '../types/index';
import type { MarketDataAdapter } from './market-data';

export class MockMarketDataAdapter implements MarketDataAdapter {
    private handlers: Array<(tick: Tick) => void> = [];
    private interval: ReturnType<typeof setInterval> | null = null;
    private symbols: string[];
    private basePrice: number;

    constructor(symbols: string[] = ['BTC'], basePrice = 83000) {
        this.symbols = symbols;
        this.basePrice = basePrice;
    }

    async connect(): Promise<void> {
        // Emit ticks every 500ms
        this.interval = setInterval(() => {
            for (const symbol of this.symbols) {
                const jitter = (Math.random() - 0.5) * this.basePrice * 0.001;
                const mid = this.basePrice + jitter;
                const spread = mid * 0.0001;
                const tick: Tick = {
                    symbol,
                    mid: mid.toFixed(2),
                    bid: (mid - spread).toFixed(2),
                    ask: (mid + spread).toFixed(2),
                    timestamp: Date.now(),
                };
                for (const h of this.handlers) h(tick);
            }
        }, 500);
    }

    onTick(handler: (tick: Tick) => void): void {
        this.handlers.push(handler);
    }

    /** Manually push a single tick (useful in tests). */
    pushTick(tick: Tick): void {
        for (const h of this.handlers) h(tick);
    }

    disconnect(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.handlers = [];
    }
}
