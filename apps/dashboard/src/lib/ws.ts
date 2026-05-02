/**
 * WebSocket client — reconnecting, RAF-batched, subscription-based.
 */

import ReconnectingWebSocket from 'reconnecting-websocket';
import { WS_URL } from '../lib/config';
import { useTradingStore, TickBatcher } from '../stores/trading';

let ws: ReconnectingWebSocket | null = null;
const batcher = new TickBatcher();

export function connectWs(): void {
    if (ws) return;

    ws = new ReconnectingWebSocket(WS_URL);
    const store = useTradingStore.getState();

    ws.addEventListener('open', () => {
        useTradingStore.getState().setWsConnected(true);
        console.log('[WS] Connected');

        // Subscribe to market data
        send({ type: 'subscribe', subscription: { type: 'allMids' } });

        // Subscribe to active symbol l2Book
        const sym = useTradingStore.getState().activeSymbol;
        send({ type: 'subscribe', subscription: { type: 'l2Book', coin: sym } });

        // Subscribe to account data if authenticated
        const { jwt, address } = useTradingStore.getState();
        if (jwt && address) {
            send({ type: 'subscribe', subscription: { type: 'orderUpdates', user: address }, token: `Bearer ${jwt}` });
            send({ type: 'subscribe', subscription: { type: 'userFills', user: address }, token: `Bearer ${jwt}` });
        }
    });

    ws.addEventListener('close', () => {
        useTradingStore.getState().setWsConnected(false);
    });

    ws.addEventListener('message', (event) => {
        const t0 = performance.now();
        try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch { /* ignore parse errors */ }
        const latency = performance.now() - t0;
        useTradingStore.getState().setLatencyMs(Math.round(latency * 100) / 100);
    });
}

function handleMessage(msg: any): void {
    // Handle ping/pong heartbeat
    if (msg.type === 'ping') {
        send({ type: 'pong' });
        return;
    }

    // Handle channel data
    if (msg.channel === 'allMids' && msg.data?.mids) {
        const mids = msg.data.mids as Record<string, string>;
        for (const [sym, mid] of Object.entries(mids)) {
            batcher.enqueue(sym, mid);
        }
        return;
    }

    if (msg.channel === 'userFills' && msg.data?.fills) {
        const fills = msg.data.fills;
        for (const fill of fills) {
            useTradingStore.getState().addFill(fill);
        }
        return;
    }

    if (msg.channel === 'orderUpdates' && msg.data) {
        // Refresh orders from API when we get updates
        return;
    }
}

export function send(data: any): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

export function disconnectWs(): void {
    if (ws) {
        ws.close();
        ws = null;
    }
    batcher.destroy();
}
