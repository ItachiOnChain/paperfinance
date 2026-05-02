/**
 * Demo mode REST routes.
 *
 * Protected by DEMO_MODE_SECRET env var.
 *
 *   POST /demo/start   { numBots?, scenario?, secret }
 *   POST /demo/stop    { secret }
 *   POST /demo/setBots { count, secret }
 *   POST /demo/scenario { scenario, secret }
 *   GET  /demo/status
 */

import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import type { DemoController } from '../lib/demo/demo-controller';
import type { ScenarioName } from '../lib/demo/scenario-runner';

function verifySecret(secret?: string): boolean {
    const expected = config.DEMO_MODE_SECRET;
    if (!expected) return true; // No secret configured = always allow
    return secret === expected;
}

export function registerDemoRoutes(app: FastifyInstance, demo: DemoController): void {
    app.post('/demo/start', async (req, reply) => {
        const body = req.body as { numBots?: number; scenario?: ScenarioName; secret?: string } | null;
        if (!verifySecret(body?.secret)) {
            return reply.status(403).send({ error: 'Invalid demo secret' });
        }
        try {
            await demo.start({ numBots: body?.numBots, scenario: body?.scenario });
            return { status: 'started', ...demo.getStatus() };
        } catch (e) {
            return reply.status(500).send({ error: (e as Error).message });
        }
    });

    app.post('/demo/stop', async (req, reply) => {
        const body = req.body as { secret?: string } | null;
        if (!verifySecret(body?.secret)) {
            return reply.status(403).send({ error: 'Invalid demo secret' });
        }
        await demo.stop();
        return { status: 'stopped' };
    });

    app.post('/demo/setBots', async (req, reply) => {
        const body = req.body as { count?: number; secret?: string } | null;
        if (!verifySecret(body?.secret)) {
            return reply.status(403).send({ error: 'Invalid demo secret' });
        }
        const count = Math.max(0, Math.min(50, body?.count ?? 0));
        try {
            await demo.setBots(count);
            return { status: 'ok', bots: count };
        } catch (e) {
            return reply.status(400).send({ error: (e as Error).message });
        }
    });

    app.post('/demo/scenario', async (req, reply) => {
        const body = req.body as { scenario?: ScenarioName; secret?: string } | null;
        if (!verifySecret(body?.secret)) {
            return reply.status(403).send({ error: 'Invalid demo secret' });
        }
        if (!body?.scenario) {
            return reply.status(400).send({ error: 'Missing scenario' });
        }
        try {
            await demo.runScenario(body.scenario);
            return { status: 'running', scenario: body.scenario };
        } catch (e) {
            return reply.status(400).send({ error: (e as Error).message });
        }
    });

    app.get('/demo/status', async () => {
        return demo.getStatus();
    });

    console.log('[Routes] Demo routes registered: /demo/start, /demo/stop, /demo/setBots, /demo/scenario, /demo/status');
}
