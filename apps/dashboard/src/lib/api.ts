/** Fetch helpers for the engine REST API */

import { API_URL } from './config';

async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
    const res = await fetch(`${API_URL}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...opts.headers,
        },
    });
    return res.json();
}

function authHeaders(jwt: string): HeadersInit {
    return { Authorization: `Bearer ${jwt}` };
}

// ── Public endpoints ─────────────────────────────────────
export const api = {
    health: () => apiFetch('/health'),

    allMids: () => apiFetch('/info', {
        method: 'POST',
        body: JSON.stringify({ type: 'allMids' }),
    }),

    openOrders: (user: string) => apiFetch('/info', {
        method: 'POST',
        body: JSON.stringify({ type: 'openOrders', user }),
    }),

    clearinghouseState: (user: string) => apiFetch('/info', {
        method: 'POST',
        body: JSON.stringify({ type: 'clearinghouseState', user }),
    }),

    userFills: (user: string) => apiFetch('/info', {
        method: 'POST',
        body: JSON.stringify({ type: 'userFills', user }),
    }),

    meta: () => apiFetch('/info', {
        method: 'POST',
        body: JSON.stringify({ type: 'meta' }),
    }),

    leaderboard: (limit = 50) => apiFetch(`/leaderboard?limit=${limit}`),

    proof: (address: string) => apiFetch(`/account/proof?address=${address}`),

    // ── Auth ─────────────────────────────────────────────────
    getNonce: (address: string) =>
        apiFetch(`/auth/nonce?address=${address}`, { method: 'POST' }),

    verify: (message: string, signature: string) =>
        apiFetch('/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ message, signature }),
        }),

    // ── Authenticated ────────────────────────────────────────
    placeOrder: (jwt: string, order: any) =>
        apiFetch('/exchange', {
            method: 'POST',
            headers: authHeaders(jwt),
            body: JSON.stringify({ type: 'order', order }),
        }),

    cancelOrder: (jwt: string, orderId: string) =>
        apiFetch('/exchange', {
            method: 'POST',
            headers: authHeaders(jwt),
            body: JSON.stringify({ type: 'cancel', cancel: { orderId } }),
        }),

    verifyDeposit: (jwt: string, txHash: string) =>
        apiFetch('/deposit/verify', {
            method: 'POST',
            headers: authHeaders(jwt),
            body: JSON.stringify({ txHash }),
        }),
};
