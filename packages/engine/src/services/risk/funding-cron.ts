/**
 * FundingCron — hourly funding rate settlement.
 *
 * Fetches current funding rate from Binance, scans all positions
 * per symbol, and debits/credits funding payments atomically.
 */

import { redis, KEYS } from '../../lib/redis';
import { computeFundingPayment } from './margin-math';
import { internalToBinance } from '../market-data/symbol-map';

// ── Supported symbols for funding ──────────────────────────
const FUNDING_SYMBOLS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP', 'AVAX-PERP'];

// ── Binance funding rate response ──────────────────────────
interface BinanceFundingRate {
    symbol: string;
    fundingRate: string;
    fundingTime: number;
    markPrice: string;
}

export class FundingCron {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private intervalMs: number;

    constructor(intervalMs: number = 3_600_000) { // default 1 hour
        this.intervalMs = intervalMs;
    }

    start(): void {
        console.log(`[FundingCron] started — interval: ${this.intervalMs / 1000}s`);
        // Run immediately on start, then on interval
        this.run().catch((err) => console.error('[FundingCron] initial run error:', err));
        this.intervalId = setInterval(() => {
            this.run().catch((err) => console.error('[FundingCron] interval error:', err));
        }, this.intervalMs);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('[FundingCron] stopped');
    }

    /**
     * Main funding cycle: for each symbol, fetch rate and settle.
     */
    private async run(): Promise<void> {
        console.log('[FundingCron] running funding settlement cycle');
        let totalPayments = 0;

        for (const symbol of FUNDING_SYMBOLS) {
            try {
                const count = await this.processSymbol(symbol);
                totalPayments += count;
            } catch (err) {
                console.error(`[FundingCron] error processing ${symbol}:`, err);
            }
        }

        console.log(`[FundingCron] cycle complete — ${totalPayments} payments processed`);
    }

    /**
     * Process funding for a single symbol.
     */
    private async processSymbol(symbol: string): Promise<number> {
        // 1. Fetch funding rate from Binance
        const rate = await this.fetchFundingRate(symbol);
        if (rate === null) return 0;

        // 2. Get current mark price
        const markPriceStr = await redis.get(KEYS.marketMid(symbol));
        const markPrice = markPriceStr ? parseFloat(markPriceStr) : 0;
        if (markPrice <= 0) return 0;

        // 3. Scan all positions for this symbol
        const pattern = KEYS.positionPattern(symbol);
        let cursor = '0';
        let count = 0;

        do {
            const [nextCursor, keys] = await redis.scan(
                cursor, 'MATCH', pattern, 'COUNT', 100,
            );
            cursor = nextCursor;

            if (keys.length === 0) continue;

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
                if (!data.size || parseFloat(data.size) === 0) continue;

                const uid = this.extractUid(keys[i]);
                if (!uid) continue;

                const size = Math.abs(parseFloat(data.size));
                const side = (data.side || 'long') as 'long' | 'short';
                const notional = size * markPrice;

                const payment = computeFundingPayment(notional, rate, side);

                // Execute atomic Lua: debit balance + record to stream
                await redis.fundingPayment(
                    KEYS.balance(uid),
                    KEYS.fundingStream(uid),
                    uid,
                    symbol,
                    payment.toFixed(8),
                    rate.toFixed(8),
                    notional.toFixed(8),
                    Date.now().toString(),
                );

                count++;
            }
        } while (cursor !== '0');

        if (count > 0) {
            console.log(`[FundingCron] ${symbol}: rate=${(rate * 100).toFixed(4)}% — ${count} positions settled`);
        }

        return count;
    }

    /**
     * Fetch funding rate from Binance Futures API.
     */
    private async fetchFundingRate(symbol: string): Promise<number | null> {
        const binanceSymbol = internalToBinance(symbol);
        if (!binanceSymbol) return null;

        // Binance futures uses uppercase without hyphen: BTCUSDT
        const futuresSymbol = binanceSymbol.toUpperCase();

        try {
            const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${futuresSymbol}&limit=1`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[FundingCron] Binance API ${response.status} for ${futuresSymbol}`);
                return null;
            }

            const data = await response.json() as BinanceFundingRate[];
            if (!data || data.length === 0) return null;

            return parseFloat(data[0].fundingRate);
        } catch (err) {
            console.error(`[FundingCron] fetch error for ${futuresSymbol}:`, err);
            return null;
        }
    }

    private extractUid(key: string): string | null {
        const match = key.match(/^account:(.+?):positions:/);
        return match ? match[1] : null;
    }
}
