/**
 * WebSocket server — @fastify/websocket based.
 *
 * Subscription protocol:
 *   { type: "subscribe", subscription: { type: "allMids" | "l2Book" | "orderUpdates" | "userFills" | "userFunding", user?, coin? } }
 *   { type: "unsubscribe", subscription: { ... } }
 *   { type: "pong" } — response to server ping
 *
 * Auth: account-level subscriptions (orderUpdates, userFills, userFunding)
 *   require a valid JWT in the subscribe message: { ..., token: "Bearer ..." }
 *
 * Heartbeat: server sends { type: "ping" } every 30s.
 *   Client must reply { type: "pong" } within 5s or connection is closed.
 */

import jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { redis, KEYS } from '../lib/redis';
import { normalizeAddress } from '../lib/normalizeAddress';
import type { EvmAddress } from '../lib/normalizeAddress';
import { config } from '../config';

const HEARTBEAT_INTERVAL = 30_000;
const PONG_TIMEOUT = 5_000;

const ACCOUNT_SUBS = new Set(['orderUpdates', 'userFills', 'userFunding']);

interface ClientState {
    ws: WebSocket;
    subscriptions: Set<string>;
    isAlive: boolean;
    pongTimer: ReturnType<typeof setTimeout> | null;
}

// Global state
const clients = new Map<WebSocket, ClientState>();
const subscriptionIndex = new Map<string, Set<WebSocket>>();

function subKey(sub: { type: string; user?: string; coin?: string }): string | null {
    switch (sub.type) {
        case 'allMids': return 'allMids';
        case 'l2Book': return sub.coin ? `l2Book:${sub.coin}` : null;
        case 'orderUpdates': return sub.user ? `orderUpdates:${sub.user}` : null;
        case 'userFills': return sub.user ? `userFills:${sub.user}` : null;
        case 'userFunding': return sub.user ? `userFunding:${sub.user}` : null;
        case 'engineEvents': return 'engineEvents';
        default: return null;
    }
}

function send(ws: WebSocket, data: unknown): void {
    if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(data));
    }
}

function broadcast(key: string, data: unknown): void {
    const subs = subscriptionIndex.get(key);
    if (!subs || subs.size === 0) return;
    const json = JSON.stringify(data);
    for (const ws of subs) {
        if (ws.readyState === 1) ws.send(json);
    }
}

function removeClient(state: ClientState): void {
    for (const key of state.subscriptions) {
        subscriptionIndex.get(key)?.delete(state.ws);
    }
    if (state.pongTimer) clearTimeout(state.pongTimer);
    clients.delete(state.ws);
}

function verifyToken(token: string): EvmAddress | null {
    try {
        const secret = config.JWT_SECRET || '';
        if (!secret) return null;
        const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;
        const payload = jwt.verify(bearer, secret) as { sub: string };
        return normalizeAddress(payload.sub);
    } catch {
        return null;
    }
}

async function handleSubscribe(
    state: ClientState,
    sub: { type: string; user?: string; coin?: string },
    token?: string,
): Promise<void> {
    // Account-level subs require auth
    if (ACCOUNT_SUBS.has(sub.type)) {
        if (!token) {
            send(state.ws, { type: 'error', msg: 'unauthorized — token required for account subscriptions' });
            return;
        }
        const addr = verifyToken(token);
        if (!addr) {
            send(state.ws, { type: 'error', msg: 'unauthorized — invalid token' });
            return;
        }
        // Ensure user can only subscribe to their own account
        if (sub.user && normalizeAddress(sub.user) !== addr) {
            send(state.ws, { type: 'error', msg: 'unauthorized — cannot subscribe to other accounts' });
            return;
        }
        sub.user = addr;
    }

    const key = subKey(sub);
    if (!key) {
        send(state.ws, { type: 'error', msg: 'invalid subscription' });
        return;
    }

    state.subscriptions.add(key);
    if (!subscriptionIndex.has(key)) subscriptionIndex.set(key, new Set());
    subscriptionIndex.get(key)!.add(state.ws);

    send(state.ws, { type: 'subscriptionResponse', subscription: sub });

    // Send snapshot for allMids
    if (sub.type === 'allMids') {
        const mids: Record<string, string> = {};
        for (const sym of ['BTC-PERP', 'ETH-PERP']) {
            const mid = await redis.get(KEYS.marketMid(sym));
            if (mid) mids[sym] = mid;
        }
        if (Object.keys(mids).length > 0) {
            send(state.ws, { channel: 'allMids', data: { mids } });
        }
    }
}

function handleUnsubscribe(state: ClientState, sub: { type: string; user?: string; coin?: string }): void {
    const key = subKey(sub);
    if (!key) return;
    state.subscriptions.delete(key);
    subscriptionIndex.get(key)?.delete(state.ws);
    send(state.ws, { type: 'subscriptionResponse', method: 'unsubscribe', subscription: sub });
}

/**
 * Register WebSocket handler on Fastify via @fastify/websocket.
 */
export function registerWebSocket(app: FastifyInstance): void {
    // Heartbeat timer
    const heartbeat = setInterval(() => {
        for (const [, state] of clients) {
            if (!state.isAlive) {
                state.ws.terminate();
                removeClient(state);
                continue;
            }
            state.isAlive = false;
            send(state.ws, { type: 'ping' });
            // Set pong timeout
            state.pongTimer = setTimeout(() => {
                if (!state.isAlive) {
                    state.ws.terminate();
                    removeClient(state);
                }
            }, PONG_TIMEOUT);
        }
    }, HEARTBEAT_INTERVAL);

    // Clean up on server close
    app.addHook('onClose', () => {
        clearInterval(heartbeat);
        for (const [, state] of clients) {
            state.ws.terminate();
        }
        clients.clear();
        subscriptionIndex.clear();
    });

    app.get('/ws', { websocket: true }, (socket, _req) => {
        const ws = socket as unknown as WebSocket;
        const state: ClientState = {
            ws,
            subscriptions: new Set(),
            isAlive: true,
            pongTimer: null,
        };
        clients.set(ws, state);

        // Send connected message
        send(ws, { type: 'connected' });

        ws.on('message', async (raw: Buffer) => {
            let msg: any;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                send(ws, { type: 'error', msg: 'invalid JSON' });
                return;
            }

            switch (msg.type) {
                case 'subscribe':
                    if (msg.subscription) {
                        await handleSubscribe(state, msg.subscription, msg.token);
                    }
                    break;
                case 'unsubscribe':
                    if (msg.subscription) handleUnsubscribe(state, msg.subscription);
                    break;
                case 'pong':
                    state.isAlive = true;
                    if (state.pongTimer) {
                        clearTimeout(state.pongTimer);
                        state.pongTimer = null;
                    }
                    break;
                default:
                    send(ws, { type: 'error', msg: `unknown message type: ${msg.type}` });
            }
        });

        ws.on('close', () => removeClient(state));
        ws.on('error', () => removeClient(state));
    });

    console.log('[WS] WebSocket server registered at /ws');
}

/**
 * Broadcast a market mid update to all allMids subscribers.
 */
export function broadcastMids(mids: Record<string, string>): void {
    broadcast('allMids', { channel: 'allMids', data: { mids } });
}

/**
 * Broadcast an order update to a specific user's subscribers.
 */
export function broadcastOrderUpdate(user: EvmAddress, data: unknown): void {
    broadcast(`orderUpdates:${user}`, { channel: 'orderUpdates', data });
}

/**
 * Broadcast a fill to a specific user's subscribers.
 */
export function broadcastFill(user: EvmAddress, fill: unknown): void {
    broadcast(`userFills:${user}`, { channel: 'userFills', data: { user, fills: [fill] } });
}

/**
 * Broadcast engine events to engineEvents subscribers.
 * Rate-limited to 20 events/sec to avoid flooding clients.
 */
let engineEventCounter = 0;
let engineEventResetTimer: ReturnType<typeof setInterval> | null = null;

function ensureEngineEventTimer(): void {
    if (engineEventResetTimer) return;
    engineEventResetTimer = setInterval(() => { engineEventCounter = 0; }, 1000);
}

export function broadcastEngineEvent(event: {
    event: 'fill' | 'tick' | 'liquidation' | 'funding';
    symbol: string;
    latencyUs: number;
    ts: number;
}): void {
    ensureEngineEventTimer();
    if (engineEventCounter >= 20) return; // cap at 20/sec
    engineEventCounter++;
    broadcast('engineEvents', { channel: 'engineEvents', data: event });
}
