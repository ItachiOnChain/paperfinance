/**
 * Core domain types for the paper trading engine.
 * Matches the HyPaper schema with multi-chain abstraction.
 */

import type { EvmAddress } from '../lib/normalizeAddress';

// ── Tick (market data) ─────────────────────────────────────
export interface Tick {
    symbol: string;
    /** Mid-price as decimal string */
    mid: string;
    /** Best bid */
    bid: string;
    /** Best ask */
    ask: string;
    /** Unix timestamp ms */
    timestamp: number;
}

// ── Order ──────────────────────────────────────────────────
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected' | 'liquidated';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface Order {
    /** UUID v7 — monotonically ordered */
    id: string;
    uid: EvmAddress;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    /** Order size (decimal string) */
    size: string;
    /** Limit price (decimal string, required for limit orders) */
    price: string;
    status: OrderStatus;
    /** Filled quantity so far */
    filledSize: string;
    /** Average fill price */
    avgFillPrice: string;
    reduceOnly: boolean;
    timeInForce: TimeInForce;
    createdAt: number;
    updatedAt: number;
}

// ── Fill ───────────────────────────────────────────────────
export interface Fill {
    /** UUID v7 */
    id: string;
    orderId: string;
    uid: EvmAddress;
    symbol: string;
    side: OrderSide;
    /** Fill size */
    size: string;
    /** Fill price */
    price: string;
    /** Fee charged (decimal string USDC) */
    fee: string;
    /** Realized PnL from closing portion */
    realizedPnl: string;
    /** Position size before this fill */
    positionBefore: string;
    /** Position size after this fill */
    positionAfter: string;
    timestamp: number;
}

// ── Position ───────────────────────────────────────────────
export type PositionSide = 'long' | 'short';

export interface Position {
    uid: EvmAddress;
    symbol: string;
    /** Signed size: positive = long, negative = short */
    size: string;
    /** 'long' or 'short' */
    side: PositionSide;
    /** Weighted average entry price */
    entryPrice: string;
    /** Leverage multiplier (default '1') */
    leverage: string;
    /** Pre-computed liquidation price */
    liquidationPrice: string;
    /** Collateral allocated to this position */
    isolatedMargin: string;
    /** Accumulated realized PnL */
    realizedPnl: string;
    updatedAt: number;
}

// ── Funding Payment ────────────────────────────────────────
export interface FundingPayment {
    uid: EvmAddress;
    symbol: string;
    /** Funding rate (decimal string) */
    rate: string;
    /** Payment amount (positive = pay, negative = receive) */
    payment: string;
    /** Position notional at time of funding */
    notional: string;
    timestamp: number;
}

// ── Account ────────────────────────────────────────────────
export interface Account {
    uid: EvmAddress;
    /** Available balance (decimal string USDC) */
    balance: string;
    createdAt: number;
}

// ── Slippage model for computeFillPrice ────────────────────
export interface SlippageModel {
    /** Basis points of slippage per $10k notional */
    bpsPerTenK: number;
    /** Maximum slippage in basis points */
    maxBps: number;
}

export const DEFAULT_SLIPPAGE: SlippageModel = {
    bpsPerTenK: 1,
    maxBps: 50,
};

// ── L2 book types (reused from HyPaper) ───────────────────
export interface L2Level {
    px: string;
    sz: string;
    n: number;
}

export interface L2Book {
    symbol: string;
    levels: [L2Level[], L2Level[]]; // [bids, asks]
    time: number;
}
