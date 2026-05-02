/**
 * Prometheus metrics — prom-client instrumentation.
 *
 * Exposes: order fill latency, WS connections, price ticks,
 * liquidations, Redis ops, RPC errors.
 */

import {
    Registry,
    Histogram,
    Gauge,
    Counter,
    collectDefaultMetrics,
} from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'hypaper-engine' });
collectDefaultMetrics({ register: registry });

// ── Histograms ──────────────────────────────────────────────
export const orderFillLatency = new Histogram({
    name: 'order_fill_latency_ms',
    help: 'Order fill latency in milliseconds',
    buckets: [0.5, 1, 2, 5, 10, 50, 100],
    registers: [registry],
});

// ── Gauges ──────────────────────────────────────────────────
export const activeWsConnections = new Gauge({
    name: 'active_ws_connections',
    help: 'Number of active WebSocket connections',
    registers: [registry],
});

export const activeBots = new Gauge({
    name: 'active_demo_bots',
    help: 'Number of active demo bots',
    registers: [registry],
});

// ── Counters ────────────────────────────────────────────────
export const priceTicksTotal = new Counter({
    name: 'price_ticks_total',
    help: 'Total price ticks received',
    labelNames: ['symbol'] as const,
    registers: [registry],
});

export const liquidationsTotal = new Counter({
    name: 'liquidations_total',
    help: 'Total liquidations executed',
    registers: [registry],
});

export const orderFillsTotal = new Counter({
    name: 'order_fills_total',
    help: 'Total order fills executed',
    labelNames: ['symbol', 'side'] as const,
    registers: [registry],
});

export const redisOpsTotal = new Counter({
    name: 'redis_ops_total',
    help: 'Total Redis operations',
    labelNames: ['operation'] as const,
    registers: [registry],
});

export const rpcErrorsTotal = new Counter({
    name: 'rpc_errors_total',
    help: 'Total RPC errors',
    labelNames: ['method'] as const,
    registers: [registry],
});

export const wsMessagesTotal = new Counter({
    name: 'ws_messages_total',
    help: 'Total WebSocket messages sent',
    registers: [registry],
});
