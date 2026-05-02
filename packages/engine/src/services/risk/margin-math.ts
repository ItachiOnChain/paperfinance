/**
 * margin-math.ts — Pure functions for risk calculations.
 *
 * No side effects, no Redis, no I/O. Fully testable.
 */

// ── Constants ──────────────────────────────────────────────
/** Maintenance margin rate (2.5%) */
export const MAINTENANCE_MARGIN_RATE = 0.025;

/** Liquidation fee rate (0.5% of notional) */
export const LIQUIDATION_FEE_RATE = 0.005;

/** Default leverage */
export const DEFAULT_LEVERAGE = 1;

// ── Liquidation Price ──────────────────────────────────────
/**
 * Compute the liquidation price for an isolated-margin position.
 *
 * Long:  liqPrice = avgEntry × (1 - (1/leverage) + maintenanceRate)
 * Short: liqPrice = avgEntry × (1 + (1/leverage) - maintenanceRate)
 *
 * @param side       - 'long' or 'short'
 * @param avgEntry   - average entry price
 * @param leverage   - leverage multiplier (e.g. 10)
 * @param mmRate     - maintenance margin rate (default 0.025)
 * @returns liquidation price
 */
export function computeLiquidationPrice(
    side: 'long' | 'short',
    avgEntry: number,
    leverage: number,
    mmRate: number = MAINTENANCE_MARGIN_RATE,
): number {
    if (avgEntry <= 0 || leverage <= 0) return 0;

    if (side === 'long') {
        // Price must drop to trigger long liquidation
        return avgEntry * (1 - (1 / leverage) + mmRate);
    } else {
        // Price must rise to trigger short liquidation
        return avgEntry * (1 + (1 / leverage) - mmRate);
    }
}

// ── Margin Ratio ───────────────────────────────────────────
/**
 * Compute the margin ratio for a position.
 *
 * marginRatio = (positionValue × maintenanceMarginRate) / isolatedMargin
 *
 * When marginRatio >= 1.0, the position should be liquidated.
 *
 * @param positionValue   - abs(size) × currentPrice
 * @param isolatedMargin  - collateral allocated to this position
 * @param mmRate          - maintenance margin rate (default 0.025)
 * @returns margin ratio (>= 1.0 means liquidation)
 */
export function computeMarginRatio(
    positionValue: number,
    isolatedMargin: number,
    mmRate: number = MAINTENANCE_MARGIN_RATE,
): number {
    if (isolatedMargin <= 0) return Infinity;
    return (positionValue * mmRate) / isolatedMargin;
}

// ── Unrealized PnL ─────────────────────────────────────────
/**
 * Compute unrealized PnL for a position.
 *
 * @param side       - 'long' or 'short'
 * @param size       - absolute position size
 * @param entryPrice - average entry price
 * @param markPrice  - current market price
 * @returns unrealized PnL (positive = profit)
 */
export function computeUnrealizedPnl(
    side: 'long' | 'short',
    size: number,
    entryPrice: number,
    markPrice: number,
): number {
    if (side === 'long') {
        return (markPrice - entryPrice) * size;
    } else {
        return (entryPrice - markPrice) * size;
    }
}

// ── Liquidation PnL ────────────────────────────────────────
/**
 * Compute the final PnL from a liquidation event.
 *
 * finalPnl = (liqPrice - avgEntry) × size × direction - liquidationFee
 * where: direction = 1 for long, -1 for short
 *        liquidationFee = size × liqPrice × LIQUIDATION_FEE_RATE
 *
 * @returns negative number (liquidation always loses money)
 */
export function computeLiquidationPnl(
    side: 'long' | 'short',
    size: number,
    avgEntry: number,
    liquidationPrice: number,
    feeRate: number = LIQUIDATION_FEE_RATE,
): number {
    const direction = side === 'long' ? 1 : -1;
    const priceDiff = (liquidationPrice - avgEntry) * direction;
    const rawPnl = priceDiff * size;
    const fee = size * liquidationPrice * feeRate;
    return rawPnl - fee;
}

// ── Funding Payment ────────────────────────────────────────
/**
 * Compute funding payment for a position.
 *
 * fundingPayment = positionNotional × fundingRate × direction
 * where: direction = 1 for long, -1 for short
 *
 * Positive payment = you pay; negative = you receive.
 *
 * @param notional     - abs(size) × markPrice
 * @param fundingRate  - from exchange (e.g. 0.0001 = 0.01%)
 * @param side         - 'long' or 'short'
 * @returns payment amount (positive = pay, negative = receive)
 */
export function computeFundingPayment(
    notional: number,
    fundingRate: number,
    side: 'long' | 'short',
): number {
    const direction = side === 'long' ? 1 : -1;
    return notional * fundingRate * direction;
}

// ── Isolated Margin ────────────────────────────────────────
/**
 * Compute the required isolated margin for opening a position.
 *
 * isolatedMargin = positionNotional / leverage
 *
 * @param notional  - abs(size) × entryPrice
 * @param leverage  - leverage multiplier
 * @returns required margin
 */
export function computeIsolatedMargin(
    notional: number,
    leverage: number,
): number {
    if (leverage <= 0) return notional;
    return notional / leverage;
}
