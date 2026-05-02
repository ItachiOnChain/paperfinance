/**
 * Integration test: BinanceAdapter → Redis price:{symbol} keys.
 *
 * Starts the BinanceAdapter, waits 4 seconds, asserts that Redis
 * contains fresh price keys with numeric values.
 *
 * This test requires network access to Binance WS (VPN may be needed).
 * It will skip gracefully if the connection fails.
 */

import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { BinanceAdapter } from '../services/market-data/binance-adapter';
import { redis, connectRedis } from '../lib/redis';

// Ensure BINANCE_WS_URL is set for this test
const BINANCE_WS_URL = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';

describe('BinanceAdapter integration', () => {
    let adapter: BinanceAdapter;
    let connected = false;

    beforeAll(async () => {
        // Connect only if not already connected
        if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
            await connectRedis();
        }
        adapter = new BinanceAdapter(['btcusdt']);
    });

    afterAll(async () => {
        if (adapter) {
            adapter.disconnect();
        }
    });

    test('receives ticks and writes price:BTC-PERP to Redis within 4s', async () => {
        let tickCount = 0;
        adapter.onTick((tick) => {
            tickCount++;
        });

        try {
            await adapter.connect();
            connected = true;
        } catch (err) {
            // Skip test if Binance WS is unreachable (e.g. no VPN)
            console.log(`[Test] Skipping: Binance WS unreachable — ${(err as Error).message}`);
            return;
        }

        // Wait 4 seconds for ticks to arrive
        await new Promise((r) => setTimeout(r, 4000));

        // Assert we received at least 1 tick
        expect(tickCount).toBeGreaterThan(0);

        // Assert Redis has a fresh price:BTC-PERP key
        const price = await redis.get('price:BTC-PERP');
        expect(price).toBeTruthy();
        expect(parseFloat(price!)).toBeGreaterThan(0);
        expect(parseFloat(price!)).toBeLessThan(10_000_000); // sanity check

        console.log(`[Test] received ${tickCount} ticks, Redis price:BTC-PERP = ${price}`);
    }, 15_000); // 15s timeout
});
