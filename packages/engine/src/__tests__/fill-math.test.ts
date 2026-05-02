/**
 * Unit tests for computeFillPrice.
 *
 * Covers: buy/sell, zero slippage, max slippage, market vs limit.
 * Uses Bun's built-in test runner.
 */

import { describe, test, expect } from 'bun:test';
import { computeFillPrice } from '../services/matching/fill-math';
import type { SlippageModel } from '../types/index';
import { DEFAULT_SLIPPAGE } from '../types/index';

describe('computeFillPrice', () => {
    const mid = 83000;

    // ── Buy side ───────────────────────────────────────────
    test('buy: fills above mid (worse for buyer)', () => {
        const price = computeFillPrice('buy', mid, 10_000);
        expect(price).toBeGreaterThan(mid);
    });

    test('sell: fills below mid (worse for seller)', () => {
        const price = computeFillPrice('sell', mid, 10_000);
        expect(price).toBeLessThan(mid);
    });

    // ── Zero slippage ──────────────────────────────────────
    test('zero slippage model: buy fills at exactly mid', () => {
        const zeroSlippage: SlippageModel = { bpsPerTenK: 0, maxBps: 0 };
        const price = computeFillPrice('buy', mid, 100_000, zeroSlippage);
        expect(price).toBe(mid);
    });

    test('zero slippage model: sell fills at exactly mid', () => {
        const zeroSlippage: SlippageModel = { bpsPerTenK: 0, maxBps: 0 };
        const price = computeFillPrice('sell', mid, 100_000, zeroSlippage);
        expect(price).toBe(mid);
    });

    test('zero size: fills at mid regardless of model', () => {
        const price = computeFillPrice('buy', mid, 0);
        expect(price).toBe(mid);
    });

    // ── Max slippage cap ───────────────────────────────────
    test('max slippage: caps at maxBps even for huge notional', () => {
        const model: SlippageModel = { bpsPerTenK: 1, maxBps: 50 };
        // $10M notional → raw bps = 1000, capped to 50
        const price = computeFillPrice('buy', mid, 10_000_000, model);
        const expectedMaxSlippage = mid * (1 + 50 / 10_000);
        expect(price).toBeCloseTo(expectedMaxSlippage, 2);
    });

    test('max slippage sell: caps at maxBps', () => {
        const model: SlippageModel = { bpsPerTenK: 1, maxBps: 50 };
        const price = computeFillPrice('sell', mid, 10_000_000, model);
        const expectedMaxSlippage = mid * (1 - 50 / 10_000);
        expect(price).toBeCloseTo(expectedMaxSlippage, 2);
    });

    // ── Slippage scales with size ──────────────────────────
    test('larger notional → more slippage (buy)', () => {
        const small = computeFillPrice('buy', mid, 1_000);
        const large = computeFillPrice('buy', mid, 100_000);
        expect(large).toBeGreaterThan(small);
    });

    test('larger notional → more slippage (sell)', () => {
        const small = computeFillPrice('sell', mid, 1_000);
        const large = computeFillPrice('sell', mid, 100_000);
        expect(large).toBeLessThan(small); // sell: lower = more slippage
    });

    // ── Default slippage for $10k notional = 1 bps ─────────
    test('default slippage: $10k notional = 1 bps', () => {
        const price = computeFillPrice('buy', mid, 10_000, DEFAULT_SLIPPAGE);
        const expected = mid * (1 + 1 / 10_000);
        expect(price).toBeCloseTo(expected, 4);
    });

    // ── Market order (fills at mid with slippage) ──────────
    test('market order simulation: buy fills with slippage', () => {
        // Market orders use mid price directly with slippage applied
        const fillPx = computeFillPrice('buy', mid, 50_000);
        expect(fillPx).toBeGreaterThan(mid);
        // Should be less than 0.5% above mid for $50k
        expect(fillPx).toBeLessThan(mid * 1.005);
    });

    test('market order simulation: sell fills with slippage', () => {
        const fillPx = computeFillPrice('sell', mid, 50_000);
        expect(fillPx).toBeLessThan(mid);
        expect(fillPx).toBeGreaterThan(mid * 0.995);
    });

    // ── Edge cases ─────────────────────────────────────────
    test('mid price of 0 returns 0', () => {
        expect(computeFillPrice('buy', 0, 10_000)).toBe(0);
        expect(computeFillPrice('sell', 0, 10_000)).toBe(0);
    });

    test('negative mid price returns mid unchanged', () => {
        expect(computeFillPrice('buy', -100, 10_000)).toBe(-100);
    });

    // ── Symmetry ───────────────────────────────────────────
    test('buy and sell slippage are symmetric around mid', () => {
        const buyPx = computeFillPrice('buy', mid, 10_000);
        const sellPx = computeFillPrice('sell', mid, 10_000);
        const buySlip = buyPx - mid;
        const sellSlip = mid - sellPx;
        expect(buySlip).toBeCloseTo(sellSlip, 4);
    });
});
