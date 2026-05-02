/**
 * BinanceAdapter — concrete MarketDataAdapter for Binance WS.
 *
 * Streams per symbol:
 *   - {symbol}@aggTrade     → mid price (uses `p` field)
 *   - {symbol}@depth20@100ms → L2 book depth for slippage
 *
 * Manual reconnection with exponential backoff (1s → 30s, ±500ms jitter).
 * Writes to Redis: SET price:{symbol} {mid} EX 10 on every tick.
 */

import WebSocket from 'ws';
import { redis } from '../../lib/redis';
import type { MarketDataAdapter } from '../../adapters/market-data';
import type { Tick } from '../../types/index';
import {
    binanceToInternal,
    getAllBinanceSymbols,
} from './symbol-map';
import { config } from '../../config';

// ── Binance aggTrade message ───────────────────────────────
interface AggTradeMsg {
    e: 'aggTrade';
    s: string;   // BTCUSDT (uppercase)
    p: string;   // price
    q: string;   // quantity
    T: number;   // trade time
}

// ── Binance partial depth message ──────────────────────────
interface DepthMsg {
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
}

// ── Redis key for cached price ─────────────────────────────
const PRICE_KEY = (symbol: string) => `price:${symbol}`;
const PRICE_TTL = 10; // seconds

// ── Reconnection config ────────────────────────────────────
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_JITTER_MS = 500;

export class BinanceAdapter implements MarketDataAdapter {
    private handlers: Array<(tick: Tick) => void> = [];
    private ws: WebSocket | null = null;
    private symbols: string[];
    private wsUrl: string;
    private shouldReconnect = true;
    private reconnectDelay = RECONNECT_BASE_MS;
    private connected = false;

    // Last known best bid/ask per symbol (populated from depth stream)
    private bestBid = new Map<string, string>();
    private bestAsk = new Map<string, string>();

    constructor(symbols?: string[]) {
        this.symbols = symbols ?? getAllBinanceSymbols();
        this.wsUrl = config.BINANCE_WS_URL;
    }

    async connect(): Promise<void> {
        if (this.connected) return; // idempotent
        this.shouldReconnect = true;

        // Build combined stream URL
        const streams = this.symbols.flatMap((s) => [
            `${s}@aggTrade`,
            `${s}@depth20@100ms`,
        ]);
        const url = `${this.wsUrl}/${streams.join('/')}`;
        console.log(`[BinanceAdapter] connecting to ${streams.length} streams for ${this.symbols.length} symbols`);

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('[BinanceAdapter] connection timeout (10s)'));
            }, 10000);

            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                clearTimeout(timeout);
                this.reconnectDelay = RECONNECT_BASE_MS;
                this.connected = true;
                console.log('[BinanceAdapter] connected ✓');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.RawData) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('error', (err) => {
                console.error('[BinanceAdapter] WS error:', err.message);
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.ws = null;
                console.warn('[BinanceAdapter] WS closed — connected=false');
                this.scheduleReconnect();
            });
        });
    }

    onTick(handler: (tick: Tick) => void): void {
        this.handlers.push(handler);
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.handlers = [];
        console.log('[BinanceAdapter] disconnected');
    }

    // ── Reconnection with jittered exponential backoff ─────
    private scheduleReconnect(): void {
        if (!this.shouldReconnect) return;
        const jitter = (Math.random() - 0.5) * 2 * RECONNECT_JITTER_MS;
        const delay = Math.min(this.reconnectDelay + jitter, RECONNECT_MAX_MS);
        console.log(`[BinanceAdapter] reconnecting in ${Math.round(delay)}ms`);
        setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
            this.connect().catch((err) => {
                console.error('[BinanceAdapter] reconnect failed:', err);
            });
        }, delay);
    }

    // ── Message router ─────────────────────────────────────
    private handleMessage(raw: string): void {
        try {
            const msg = JSON.parse(raw);

            // Combined stream format: { stream: "btcusdt@aggTrade", data: {...} }
            if (msg.stream && msg.data) {
                const stream = msg.stream as string;
                if (stream.endsWith('@aggTrade')) {
                    this.handleAggTrade(msg.data as AggTradeMsg);
                } else if (stream.includes('@depth')) {
                    const binanceSymbol = stream.split('@')[0];
                    this.handleDepth(binanceSymbol, msg.data as DepthMsg);
                }
                return;
            }

            // Single stream format (no wrapper)
            if (msg.e === 'aggTrade') {
                this.handleAggTrade(msg as AggTradeMsg);
            }
        } catch (err) {
            console.error('[BinanceAdapter] parse error:', err);
        }
    }

    // ── aggTrade → Tick ────────────────────────────────────
    private handleAggTrade(msg: AggTradeMsg): void {
        const binanceSymbol = msg.s.toLowerCase(); // btcusdt
        const internal = binanceToInternal(binanceSymbol);
        if (!internal) return;

        const mid = msg.p;
        const bid = this.bestBid.get(binanceSymbol) ?? mid;
        const ask = this.bestAsk.get(binanceSymbol) ?? mid;

        const tick: Tick = {
            symbol: internal,
            mid,
            bid,
            ask,
            timestamp: msg.T,
        };

        // Write to Redis with TTL
        redis.set(PRICE_KEY(internal), mid, 'EX', PRICE_TTL).catch((err) => {
            console.error(`[BinanceAdapter] Redis SET error for ${internal}:`, err);
        });

        // Notify all handlers
        for (const h of this.handlers) {
            try {
                h(tick);
            } catch (err) {
                console.error('[BinanceAdapter] handler error:', err);
            }
        }
    }

    // ── depth20 → update best bid/ask ──────────────────────
    private handleDepth(binanceSymbol: string, msg: DepthMsg): void {
        if (msg.bids && msg.bids.length > 0) {
            this.bestBid.set(binanceSymbol, msg.bids[0][0]);
        }
        if (msg.asks && msg.asks.length > 0) {
            this.bestAsk.set(binanceSymbol, msg.asks[0][0]);
        }
    }
}
