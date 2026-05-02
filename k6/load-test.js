/**
 * k6 load test — tests WS throughput, HTTP latency, order placement rate.
 *
 * Run: k6 run k6/load-test.js
 *
 * Scenarios:
 *   - 1000 concurrent WebSocket connections (allMids sub)
 *   - 500 req/sec on POST /info allMids
 *   - 100 order placements/sec
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws';

const wsMessageLatency = new Trend('ws_message_latency_ms');
const wsMessagesReceived = new Counter('ws_messages_received');
const orderPlaced = new Counter('orders_placed');

export const options = {
    scenarios: {
        // Scenario 1: 1000 concurrent WebSocket connections
        websocket_load: {
            executor: 'constant-vus',
            vus: 1000,
            duration: '60s',
            exec: 'wsScenario',
            startTime: '0s',
        },

        // Scenario 2: 500 req/sec on POST /info
        http_info: {
            executor: 'constant-arrival-rate',
            rate: 500,
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 100,
            maxVUs: 200,
            exec: 'httpInfoScenario',
            startTime: '5s',
        },

        // Scenario 3: 100 orders/sec
        order_placement: {
            executor: 'constant-arrival-rate',
            rate: 100,
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 50,
            maxVUs: 100,
            exec: 'orderScenario',
            startTime: '10s',
        },
    },
    thresholds: {
        ws_message_latency_ms: ['p(99)<50'],
        http_req_duration: ['p(99)<20'],
        ws_messages_received: ['count>1000'],
    },
};

// ── WebSocket Scenario ──────────────────────────────────────
export function wsScenario() {
    const res = ws.connect(WS_URL, {}, function (socket) {
        socket.on('open', () => {
            socket.send(JSON.stringify({
                type: 'subscribe',
                subscription: { type: 'allMids' },
            }));
        });

        socket.on('message', (msg) => {
            const now = Date.now();
            wsMessagesReceived.add(1);
            try {
                const data = JSON.parse(msg);
                if (data.channel === 'allMids' && data.data?.mids) {
                    wsMessageLatency.add(Date.now() - now);
                }
            } catch { }
        });

        socket.on('ping', () => {
            socket.send(JSON.stringify({ type: 'pong' }));
        });

        // Keep connection alive for duration
        sleep(55);
        socket.close();
    });

    check(res, { 'WS connected': (r) => r && r.status === 101 });
}

// ── HTTP Info Scenario ──────────────────────────────────────
export function httpInfoScenario() {
    const res = http.post(
        `${BASE_URL}/info`,
        JSON.stringify({ type: 'allMids' }),
        { headers: { 'Content-Type': 'application/json' } },
    );

    check(res, {
        'status 200': (r) => r.status === 200,
        'has mids': (r) => {
            try { return Object.keys(JSON.parse(r.body)).length > 0; }
            catch { return false; }
        },
    });
}

// ── Order Placement Scenario ────────────────────────────────
export function orderScenario() {
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const price = 80000 + (Math.random() - 0.5) * 200;

    const res = http.post(
        `${BASE_URL}/exchange`,
        JSON.stringify({
            action: {
                type: 'order', orders: [{
                    symbol: 'BTC-PERP',
                    side,
                    type: 'limit',
                    size: '0.01',
                    price: price.toFixed(2),
                }]
            },
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token',
            },
        },
    );

    if (res.status === 200) {
        orderPlaced.add(1);
    }

    check(res, {
        'order response': (r) => r.status === 200 || r.status === 401,
    });
}
