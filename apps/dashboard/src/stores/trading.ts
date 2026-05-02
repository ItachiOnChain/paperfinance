/**
 * Zustand Trading Store — central state for the trading dashboard.
 *
 * Uses shallow selectors for performance (no re-renders on unchanged slices).
 * RAF-batched WS updates via TickBatcher.
 */

import { create } from 'zustand';
import type { Symbol } from '../lib/config';

export interface Position {
    coin: string;
    side: string;
    size: string;
    entryPrice: string;
    liquidationPrice?: string;
    unrealizedPnl?: string;
}

export interface Fill {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    size: string;
    price: string;
    fee: string;
    realizedPnl: string;
    timestamp: number;
}

export interface Order {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: string;
    size: string;
    price: string;
    status: string;
}

interface TradingState {
    // Auth
    jwt: string | null;
    address: string | null;
    setAuth: (jwt: string, address: string) => void;
    clearAuth: () => void;

    // Market data
    mids: Record<string, string>;
    setMids: (mids: Record<string, string>) => void;
    updateMid: (symbol: string, mid: string) => void;

    // Active symbol
    activeSymbol: Symbol;
    setActiveSymbol: (s: Symbol) => void;

    // Account
    balance: string;
    setBalance: (b: string) => void;
    positions: Position[];
    setPositions: (p: Position[]) => void;
    fills: Fill[];
    addFill: (f: Fill) => void;
    setFills: (fills: Fill[]) => void;
    orders: Order[];
    setOrders: (o: Order[]) => void;

    // WS state
    wsConnected: boolean;
    setWsConnected: (c: boolean) => void;
    latencyMs: number;
    setLatencyMs: (l: number) => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
    // Auth
    jwt: null,
    address: null,
    setAuth: (jwt, address) => set({ jwt, address }),
    clearAuth: () => set({ jwt: null, address: null }),

    // Market data
    mids: {},
    setMids: (mids) => set({ mids }),
    updateMid: (symbol, mid) => set((s) => ({ mids: { ...s.mids, [symbol]: mid } })),

    // Active symbol
    activeSymbol: 'BTC-PERP',
    setActiveSymbol: (activeSymbol) => set({ activeSymbol }),

    // Account
    balance: '0',
    setBalance: (balance) => set({ balance }),
    positions: [],
    setPositions: (positions) => set({ positions }),
    fills: [],
    addFill: (f) => set((s) => ({ fills: [f, ...s.fills].slice(0, 500) })),
    setFills: (fills) => set({ fills }),
    orders: [],
    setOrders: (orders) => set({ orders }),

    // WS
    wsConnected: false,
    setWsConnected: (wsConnected) => set({ wsConnected }),
    latencyMs: 0,
    setLatencyMs: (latencyMs) => set({ latencyMs }),
}));

/**
 * TickBatcher — batch WS updates via requestAnimationFrame.
 * Prevents flooding React with re-renders on every tick.
 */
export class TickBatcher {
    private pendingMids: Record<string, string> = {};
    private rafId: number | null = null;

    enqueue(symbol: string, mid: string): void {
        this.pendingMids[symbol] = mid;
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => this.flush());
        }
    }

    private flush(): void {
        this.rafId = null;
        const mids = { ...this.pendingMids };
        this.pendingMids = {};
        const store = useTradingStore.getState();
        store.setMids({ ...store.mids, ...mids });
    }

    destroy(): void {
        if (this.rafId) cancelAnimationFrame(this.rafId);
    }
}
