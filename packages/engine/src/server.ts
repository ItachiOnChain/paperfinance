/**
 * Fastify HTTP + WebSocket server.
 *
 * Endpoints:
 *   GET  /health           → system health
 *   POST /auth/nonce       → SIWE nonce
 *   POST /auth/verify      → SIWE verify → JWT
 *   POST /exchange         → order/cancel (JWT auth)
 *   POST /info             → public queries
 *   POST /deposit/verify   → check deposit status (JWT auth)
 *   GET  /leaderboard      → top accounts
 *   GET  /account/proof    → Merkle proof
 *   POST /demo/*           → demo mode control
 *   WS   /ws               → real-time subscriptions
 */

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebSocket from '@fastify/websocket';
import { redis } from './lib/redis';
import { config } from './config';
import { registerAuthRoutes } from './services/auth/siwe';
import { registerProofRoutes } from './services/settlement/proof-server';
import { registerInfoRoutes } from './routes/info';
import { registerDepositRoutes, registerLeaderboardRoutes } from './routes/misc';
import { registerWebSocket } from './routes/ws';
import { registerDemoRoutes } from './routes/demo';
import type { MatchingEngine } from './services/matching/engine';
import type { DemoController } from './lib/demo/demo-controller';

export async function buildServer(engine: MatchingEngine, demo?: DemoController) {
    const app = Fastify({ logger: false });
    const startTime = Date.now();

    // ── Plugins ──────────────────────────────────────────────
    await app.register(fastifyCors, { origin: true });
    await app.register(fastifyRateLimit, {
        max: config.RATE_LIMIT_MAX,
        timeWindow: config.RATE_LIMIT_WINDOW_MS,
        keyGenerator: (req) => req.ip,
    });
    await app.register(fastifyWebSocket);

    // ── GET /health ──────────────────────────────────────────
    app.get('/health', async (_req, reply) => {
        const t0 = Date.now();
        try {
            await redis.ping();
        } catch {
            return reply.status(503).send({
                status: 'error',
                redisLatency: -1,
                uptime: Math.floor((Date.now() - startTime) / 1000),
            });
        }
        const redisLatency = Date.now() - t0;
        const uptime = Math.floor((Date.now() - startTime) / 1000);

        return {
            status: 'ok',
            redisLatency: `${redisLatency}ms`,
            uptime: `${uptime}s`,
            demo: demo?.active || false,
        };
    });

    // ── GET /metrics (Prometheus) ────────────────────────────
    const { registry } = await import('./lib/metrics');
    app.get('/metrics', async (_req, reply) => {
        reply.header('Content-Type', registry.contentType);
        return registry.metrics();
    });

    // ── Route groups ─────────────────────────────────────────
    registerAuthRoutes(app);
    registerProofRoutes(app);
    registerInfoRoutes(app);
    registerDepositRoutes(app);
    registerLeaderboardRoutes(app);

    // ── POST /exchange (needs engine ref) ────────────────────
    const { registerExchangeRoutes } = await import('./routes/exchange');
    registerExchangeRoutes(app, engine);

    // ── Demo routes ──────────────────────────────────────────
    if (demo) registerDemoRoutes(app, demo);

    // ── WebSocket ────────────────────────────────────────────
    registerWebSocket(app);

    return app;
}

export async function startServer(engine: MatchingEngine, demo?: DemoController) {
    const app = await buildServer(engine, demo);
    const port = config.PORT;

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`[Server] listening on http://0.0.0.0:${port}`);
    console.log(`[Server] endpoints: /health /auth /exchange /info /deposit/verify /leaderboard /account/proof /demo /ws`);

    return app;
}
