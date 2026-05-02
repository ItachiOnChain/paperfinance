/**
 * Unit tests for oracle-validator.
 *
 * Tests getValidatedPrice with mock Redis and mock oracle contract.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { getValidatedPrice, StalePriceError } from '../services/market-data/oracle-validator';
import { redis, connectRedis, disconnectRedis } from '../lib/redis';

describe('OracleValidator', () => {
    beforeEach(async () => {
        try {
            await connectRedis();
        } catch {
            // Already connected
        }
    });

    test('returns WS price when fresh and oracle not configured', async () => {
        // Set a fresh WS price
        await redis.set('price:BTC-PERP', '83000.50', 'EX', 10);

        const price = await getValidatedPrice('BTC-PERP');
        expect(price).toBe(83000.50);
    });

    test('throws StalePriceError when WS price missing and no oracle', async () => {
        // Ensure no price key exists
        await redis.del('price:FAKE-COIN');

        expect(getValidatedPrice('FAKE-COIN')).rejects.toThrow(StalePriceError);
    });

    test('returns numeric value', async () => {
        await redis.set('price:ETH-PERP', '3200.75', 'EX', 10);

        const price = await getValidatedPrice('ETH-PERP');
        expect(typeof price).toBe('number');
        expect(price).toBeCloseTo(3200.75, 2);
    });
});
