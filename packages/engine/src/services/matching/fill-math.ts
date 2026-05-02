/**
 * Fill simulation math — reused from HyPaper with minor type changes.
 *
 * computeFillPrice: given a side, mid-price, notional size,
 * and slippage model, returns the simulated fill price.
 */

import type { SlippageModel, OrderSide } from '../../types/index';
import { DEFAULT_SLIPPAGE } from '../../types/index';

/**
 * Compute a simulated fill price with synthetic VWAP-style slippage.
 *
 * Slippage grows linearly with notional size:
 *   slippageBps = min(sizeUSD / 10_000 * model.bpsPerTenK, model.maxBps)
 *
 * Buys fill above mid (worse); sells fill below mid (worse).
 *
 * @param side       'buy' or 'sell'
 * @param mid        Mid-price as a number
 * @param sizeUSD    Notional fill size in USD
 * @param model      Slippage model params (defaults to DEFAULT_SLIPPAGE)
 * @returns          Simulated fill price
 */
export function computeFillPrice(
    side: OrderSide,
    mid: number,
    sizeUSD: number,
    model: SlippageModel = DEFAULT_SLIPPAGE,
): number {
    if (mid <= 0) return mid;
    if (sizeUSD <= 0) return mid;

    // Linear slippage: bps per $10k of notional
    const rawBps = (sizeUSD / 10_000) * model.bpsPerTenK;
    const slippageBps = Math.min(rawBps, model.maxBps);
    const slippageFraction = slippageBps / 10_000;

    if (side === 'buy') {
        // Buys fill above mid (price is worse for buyer)
        return mid * (1 + slippageFraction);
    } else {
        // Sells fill below mid (price is worse for seller)
        return mid * (1 - slippageFraction);
    }
}
