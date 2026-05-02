/**
 * Symbol mapping — maps internal paper-trading symbol names
 * to Binance stream names.
 *
 * Internal: "BTC-PERP", "ETH-PERP", etc.
 * Binance:  "btcusdt", "ethusdt", etc.
 */

export interface SymbolEntry {
    /** Internal name used throughout the engine */
    internal: string;
    /** Binance stream symbol (lowercase, no separator) */
    binance: string;
    /** Decimal precision for prices */
    pricePrecision: number;
    /** Decimal precision for sizes */
    sizePrecision: number;
}

/**
 * Static symbol map — add new pairs here.
 */
export const SYMBOL_MAP: SymbolEntry[] = [
    // Core & Liquidity
    { internal: 'BTC-PERP', binance: 'btcusdt', pricePrecision: 2, sizePrecision: 5 },
    { internal: 'ETH-PERP', binance: 'ethusdt', pricePrecision: 2, sizePrecision: 4 },
    { internal: 'SOL-PERP', binance: 'solusdt', pricePrecision: 3, sizePrecision: 2 },
    { internal: 'ARB-PERP', binance: 'arbusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'OP-PERP', binance: 'opusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'AVAX-PERP', binance: 'avaxusdt', pricePrecision: 3, sizePrecision: 2 },
    { internal: 'DOGE-PERP', binance: 'dogeusdt', pricePrecision: 5, sizePrecision: 0 },
    { internal: 'XRP-PERP', binance: 'xrpusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'LTC-PERP', binance: 'ltcusdt', pricePrecision: 2, sizePrecision: 3 },
    { internal: 'LINK-PERP', binance: 'linkusdt', pricePrecision: 3, sizePrecision: 2 },

    // AI & Compute (0G aligned)
    { internal: 'FETCH-PERP', binance: 'fetusdt', pricePrecision: 4, sizePrecision: 0 },
    { internal: 'RNDR-PERP', binance: 'rndrusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'TAO-PERP', binance: 'taousdt', pricePrecision: 2, sizePrecision: 3 },
    { internal: 'AKT-PERP', binance: 'aktusdt', pricePrecision: 4, sizePrecision: 1 },

    // Modular & DA
    { internal: 'TIA-PERP', binance: 'tiausdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'EIGEN-PERP', binance: 'eigenusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'NEAR-PERP', binance: 'nearusdt', pricePrecision: 3, sizePrecision: 1 },
];

/** Look up internal name from Binance stream symbol */
export function binanceToInternal(binanceSymbol: string): string | undefined {
    const entry = SYMBOL_MAP.find((e) => e.binance === binanceSymbol.toLowerCase());
    return entry?.internal;
}

/** Look up Binance stream symbol from internal name */
export function internalToBinance(internal: string): string | undefined {
    const entry = SYMBOL_MAP.find((e) => e.internal === internal);
    return entry?.binance;
}

/** Get all Binance stream symbols */
export function getAllBinanceSymbols(): string[] {
    return SYMBOL_MAP.map((e) => e.binance);
}

/** Get all internal symbols */
export function getAllInternalSymbols(): string[] {
    return SYMBOL_MAP.map((e) => e.internal);
}
