/**
 * POST /deposit/verify — authenticated.
 * GET /leaderboard — public.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis, KEYS } from '../lib/redis';
import { authenticate } from '../services/auth/siwe';

/**
 * POST /deposit/verify { txHash }
 * Check if deposit has been indexed. If yes, return current balance.
 */
export function registerDepositRoutes(app: FastifyInstance): void {
    app.post('/deposit/verify', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
        const uid = req.uid;
        const body = req.body as { txHash?: string };

        if (!body?.txHash || typeof body.txHash !== 'string') {
            return reply.status(400).send({ error: 'Missing txHash' });
        }

        const txHash = body.txHash.toLowerCase();

        // Check if already processed
        const processed = await redis.get(KEYS.depositKey(txHash));
        if (processed) {
            const balance = await redis.get(KEYS.balance(uid));
            return {
                status: 'credited',
                balance: balance || '0',
                txHash,
            };
        }

        // Not yet indexed
        return {
            status: 'pending',
            message: 'Deposit not yet indexed. The indexer polls every 2s.',
            txHash,
        };
    });
}

/**
 * GET /leaderboard?limit=50
 * Returns top accounts by balance (simple version using Redis SCAN).
 */
export function registerLeaderboardRoutes(app: FastifyInstance): void {
    app.get('/leaderboard', async (req: FastifyRequest, reply: FastifyReply) => {
        const limit = Math.min(parseInt((req.query as any)?.limit || '50', 10), 100);

        // Check cache
        const cacheKey = `cache:leaderboard:${limit}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // Scan all balances
        const entries: Array<{ address: string; balance: number }> = [];
        let cursor = '0';
        do {
            const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'account:*:balance', 'COUNT', 200);
            cursor = newCursor;
            for (const key of keys) {
                const match = key.match(/^account:(0x[a-fA-F0-9]{40}):balance$/);
                if (!match) continue;
                const bal = await redis.get(key);
                if (bal) {
                    entries.push({ address: match[1], balance: parseFloat(bal) });
                }
            }
        } while (cursor !== '0');

        // Sort by balance descending, take top N
        entries.sort((a, b) => b.balance - a.balance);
        const top = entries.slice(0, limit).map((e, i) => ({
            rank: i + 1,
            address: e.address,
            balance: e.balance.toFixed(2),
        }));

        // Cache for 30s
        await redis.set(cacheKey, JSON.stringify(top), 'EX', 30);

        return top;
    });
}
