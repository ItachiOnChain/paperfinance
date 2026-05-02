/**
 * Unit tests for StalePriceGuard.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { StalePriceGuard } from '../services/market-data/stale-price-guard';
import { redis, connectRedis } from '../lib/redis';
import type { Tick } from '../types/index';

const makeTick = (symbol: string, mid = '83000'): Tick => ({
    symbol,
    mid,
    bid: mid,
    ask: mid,
    timestamp: Date.now(),
});

describe('StalePriceGuard', () => {
    let guard: StalePriceGuard;

    beforeEach(async () => {
        try {
            await connectRedis();
        } catch {
            // already connected
        }
        guard = new StalePriceGuard(500); // 500ms threshold for fast tests
    });

    test('isStale returns false for fresh symbols', async () => {
        const handler = guard.wrap(() => { });
        await handler(makeTick('BTC-PERP'));
        expect(guard.isStale('BTC-PERP')).toBe(false);
    });

    test('isStale returns true after threshold', async () => {
        const handler = guard.wrap(() => { });
        await handler(makeTick('ETH-PERP'));

        // Wait past threshold
        await new Promise((r) => setTimeout(r, 600));
        await guard.checkStaleness();

        expect(guard.isStale('ETH-PERP')).toBe(true);
    });

    test('clears stale flag when fresh tick arrives', async () => {
        const handler = guard.wrap(() => { });
        await handler(makeTick('SOL-PERP'));

        // Go stale
        await new Promise((r) => setTimeout(r, 600));
        await guard.checkStaleness();
        expect(guard.isStale('SOL-PERP')).toBe(true);

        // Fresh tick
        await handler(makeTick('SOL-PERP'));
        expect(guard.isStale('SOL-PERP')).toBe(false);
    });

    test('sets Redis stale:{symbol} flag', async () => {
        const handler = guard.wrap(() => { });
        await handler(makeTick('ARB-PERP'));

        await new Promise((r) => setTimeout(r, 600));
        await guard.checkStaleness();

        const val = await redis.get('stale:ARB-PERP');
        expect(val).toBe('1');
    });
});
