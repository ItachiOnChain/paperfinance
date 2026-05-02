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
    { internal: 'BTC-PERP', binance: 'btcusdt', pricePrecision: 2, sizePrecision: 5 },
    { internal: 'ETH-PERP', binance: 'ethusdt', pricePrecision: 2, sizePrecision: 4 },
    { internal: 'SOL-PERP', binance: 'solusdt', pricePrecision: 3, sizePrecision: 2 },
    { internal: 'ARB-PERP', binance: 'arbusdt', pricePrecision: 4, sizePrecision: 1 },
    { internal: 'AVAX-PERP', binance: 'avaxusdt', pricePrecision: 3, sizePrecision: 2 },
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
