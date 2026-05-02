/**
 * Unit tests for risk math functions.
 *
 * Tests:
 *  - Liquidation price at 5x, 10x, 20x for long and short
 *  - Margin ratio >= 1.0 triggers condition
 *  - Funding payment sign: long pays positive rate, short receives
 *  - Liquidation PnL is always negative
 *  - Isolated margin calculation
 */

import { describe, test, expect } from 'bun:test';
import {
    computeLiquidationPrice,
    computeMarginRatio,
    computeFundingPayment,
    computeLiquidationPnl,
    computeIsolatedMargin,
    computeUnrealizedPnl,
    MAINTENANCE_MARGIN_RATE,
    LIQUIDATION_FEE_RATE,
} from '../services/risk/margin-math';

// ── Liquidation Price ──────────────────────────────────────
describe('computeLiquidationPrice', () => {
    const mmRate = MAINTENANCE_MARGIN_RATE; // 0.025

    test('long 5x: liqPrice = entry × (1 - 1/5 + 0.025) = entry × 0.825', () => {
        const lp = computeLiquidationPrice('long', 80000, 5, mmRate);
        expect(lp).toBeCloseTo(80000 * 0.825, 2);
        expect(lp).toBeLessThan(80000); // long liq is below entry
    });

    test('long 10x: liqPrice = entry × (1 - 1/10 + 0.025) = entry × 0.925', () => {
        const lp = computeLiquidationPrice('long', 80000, 10, mmRate);
        expect(lp).toBeCloseTo(80000 * 0.925, 2);
    });

    test('long 20x: liqPrice = entry × (1 - 1/20 + 0.025) = entry × 0.975', () => {
        const lp = computeLiquidationPrice('long', 80000, 20, mmRate);
        expect(lp).toBeCloseTo(80000 * 0.975, 2);
        // Higher leverage = closer to entry = more dangerous
        const lp10 = computeLiquidationPrice('long', 80000, 10, mmRate);
        expect(lp).toBeGreaterThan(lp10);
    });

    test('short 5x: liqPrice = entry × (1 + 1/5 - 0.025) = entry × 1.175', () => {
        const lp = computeLiquidationPrice('short', 80000, 5, mmRate);
        expect(lp).toBeCloseTo(80000 * 1.175, 2);
        expect(lp).toBeGreaterThan(80000); // short liq is above entry
    });

    test('short 10x: liqPrice = entry × (1 + 1/10 - 0.025) = entry × 1.075', () => {
        const lp = computeLiquidationPrice('short', 80000, 10, mmRate);
        expect(lp).toBeCloseTo(80000 * 1.075, 2);
    });

    test('short 20x: liqPrice = entry × (1 + 1/20 - 0.025) = entry × 1.025', () => {
        const lp = computeLiquidationPrice('short', 80000, 20, mmRate);
        expect(lp).toBeCloseTo(80000 * 1.025, 2);
    });

    test('higher leverage = closer liquidation to entry', () => {
        const lp5 = computeLiquidationPrice('long', 80000, 5, mmRate);
        const lp10 = computeLiquidationPrice('long', 80000, 10, mmRate);
        const lp20 = computeLiquidationPrice('long', 80000, 20, mmRate);
        // For longs: higher lev = higher liq price (closer to entry)
        expect(lp20).toBeGreaterThan(lp10);
        expect(lp10).toBeGreaterThan(lp5);
    });

    test('returns 0 for invalid inputs', () => {
        expect(computeLiquidationPrice('long', 0, 10)).toBe(0);
        expect(computeLiquidationPrice('long', 80000, 0)).toBe(0);
        expect(computeLiquidationPrice('long', -1, 10)).toBe(0);
    });
});

// ── Margin Ratio ───────────────────────────────────────────
describe('computeMarginRatio', () => {
    test('ratio < 1.0 means safe', () => {
        // posValue=80000, margin=4000 (20x leverage)
        // ratio = 80000 * 0.025 / 4000 = 0.5
        const ratio = computeMarginRatio(80000, 4000);
        expect(ratio).toBeCloseTo(0.5, 4);
        expect(ratio).toBeLessThan(1.0);
    });

    test('ratio >= 1.0 triggers liquidation', () => {
        // posValue=80000, margin=2000
        // ratio = 80000 * 0.025 / 2000 = 1.0
        const ratio = computeMarginRatio(80000, 2000);
        expect(ratio).toBeCloseTo(1.0, 4);
        expect(ratio).toBeGreaterThanOrEqual(1.0);
    });

    test('ratio > 1.0 for undercollateralized position', () => {
        // posValue=80000, margin=1000
        // ratio = 80000 * 0.025 / 1000 = 2.0
        const ratio = computeMarginRatio(80000, 1000);
        expect(ratio).toBeCloseTo(2.0, 4);
        expect(ratio).toBeGreaterThan(1.0);
    });

    test('returns Infinity for zero margin', () => {
        expect(computeMarginRatio(80000, 0)).toBe(Infinity);
    });

    test('low position value = safe even with low margin', () => {
        // posValue=100, margin=50
        // ratio = 100 * 0.025 / 50 = 0.05
        const ratio = computeMarginRatio(100, 50);
        expect(ratio).toBeLessThan(1.0);
    });
});

// ── Funding Payment ────────────────────────────────────────
describe('computeFundingPayment', () => {
    test('long pays positive funding rate', () => {
        // notional=80000, rate=0.0001 (0.01%), long
        const payment = computeFundingPayment(80000, 0.0001, 'long');
        expect(payment).toBeCloseTo(8.0, 4); // 80000 * 0.0001 * 1
        expect(payment).toBeGreaterThan(0); // long pays
    });

    test('short receives positive funding rate', () => {
        const payment = computeFundingPayment(80000, 0.0001, 'short');
        expect(payment).toBeCloseTo(-8.0, 4); // 80000 * 0.0001 * -1
        expect(payment).toBeLessThan(0); // short receives
    });

    test('long receives negative funding rate', () => {
        const payment = computeFundingPayment(80000, -0.0001, 'long');
        expect(payment).toBeLessThan(0); // long receives when rate negative
    });

    test('short pays negative funding rate', () => {
        const payment = computeFundingPayment(80000, -0.0001, 'short');
        expect(payment).toBeGreaterThan(0); // short pays when rate negative
    });

    test('zero rate = zero payment', () => {
        expect(computeFundingPayment(80000, 0, 'long')).toBeCloseTo(0, 10);
        expect(computeFundingPayment(80000, 0, 'short')).toBeCloseTo(0, 10);
    });
});

// ── Liquidation PnL ────────────────────────────────────────
describe('computeLiquidationPnl', () => {
    test('long liquidation loses money', () => {
        // Entry 80000, liquidated at 74000 (10x long)
        const pnl = computeLiquidationPnl('long', 1, 80000, 74000);
        expect(pnl).toBeLessThan(0);
    });

    test('short liquidation loses money', () => {
        // Entry 80000, liquidated at 86000 (10x short)
        const pnl = computeLiquidationPnl('short', 1, 80000, 86000);
        expect(pnl).toBeLessThan(0);
    });

    test('liquidation fee is deducted', () => {
        const pnlNoFee = computeLiquidationPnl('long', 1, 80000, 74000, 0);
        const pnlWithFee = computeLiquidationPnl('long', 1, 80000, 74000, 0.005);
        expect(pnlWithFee).toBeLessThan(pnlNoFee);
    });
});

// ── Isolated Margin ────────────────────────────────────────
describe('computeIsolatedMargin', () => {
    test('10x leverage: margin = notional / 10', () => {
        expect(computeIsolatedMargin(80000, 10)).toBe(8000);
    });

    test('1x leverage: margin = notional', () => {
        expect(computeIsolatedMargin(80000, 1)).toBe(80000);
    });

    test('20x leverage: margin = notional / 20', () => {
        expect(computeIsolatedMargin(80000, 20)).toBe(4000);
    });
});

// ── Unrealized PnL ─────────────────────────────────────────
describe('computeUnrealizedPnl', () => {
    test('long in profit', () => {
        const pnl = computeUnrealizedPnl('long', 1, 80000, 85000);
        expect(pnl).toBe(5000);
    });

    test('long in loss', () => {
        const pnl = computeUnrealizedPnl('long', 1, 80000, 75000);
        expect(pnl).toBe(-5000);
    });

    test('short in profit', () => {
        const pnl = computeUnrealizedPnl('short', 1, 80000, 75000);
        expect(pnl).toBe(5000);
    });

    test('short in loss', () => {
        const pnl = computeUnrealizedPnl('short', 1, 80000, 85000);
        expect(pnl).toBe(-5000);
    });
});
