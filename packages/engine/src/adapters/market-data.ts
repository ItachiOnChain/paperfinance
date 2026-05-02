/**
 * MarketDataAdapter — abstract interface for market data sources.
 *
 * The matching engine depends on this interface, never on a concrete
 * implementation. Swap BinanceAdapter, MockAdapter, or any CEX feed
 * without touching the engine.
 */

import type { Tick } from '../types/index';

export interface MarketDataAdapter {
    /** Open the connection to the upstream data source. */
    connect(): Promise<void>;

    /**
     * Register a handler that fires on every incoming tick.
     * Multiple handlers may be registered; all are called in order.
     */
    onTick(handler: (tick: Tick) => void): void;

    /** Gracefully close the connection. */
    disconnect(): void;
}
