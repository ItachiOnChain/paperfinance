/**
 * POST /info — public HL-compatible info endpoint.
 *
 * Discriminated on 'type' field:
 *   - allMids, openOrders, clearinghouseState, userFills, meta
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis, KEYS } from '../lib/redis';
import { normalizeAddress } from '../lib/normalizeAddress';

// Supported trading symbols
const SUPPORTED_ASSETS = [
    { name: 'BTC-PERP', szDecimals: 5 },
    { name: 'ETH-PERP', szDecimals: 4 },
];

export function registerInfoRoutes(app: FastifyInstance): void {
    app.post('/info', async (req: FastifyRequest, reply: FastifyReply) => {
        const body = req.body as Record<string, any>;
        const type = body?.type;

        if (!type || typeof type !== 'string') {
            return reply.status(400).send({ error: 'Missing type' });
        }

        try {
            switch (type) {
                case 'allMids': {
                    // Collect all market:mid:* keys
                    const mids: Record<string, string> = {};
                    for (const asset of SUPPORTED_ASSETS) {
                        const mid = await redis.get(KEYS.marketMid(asset.name));
                        if (mid) mids[asset.name] = mid;
                    }
                    return mids;
                }

                case 'openOrders': {
                    const user = body.user;
                    if (!user) return reply.status(400).send({ error: 'Missing user' });
                    const address = normalizeAddress(user);

                    const orderIds = await redis.zrange(KEYS.openOrders(address), 0, -1);
                    const orders = [];
                    for (const oid of orderIds) {
                        const raw = await redis.get(KEYS.orderData(oid));
                        if (raw) orders.push(JSON.parse(raw));
                    }
                    return orders;
                }

                case 'clearinghouseState': {
                    const user = body.user;
                    if (!user) return reply.status(400).send({ error: 'Missing user' });
                    const address = normalizeAddress(user);

                    const balance = await redis.get(KEYS.balance(address));
                    // Collect positions
                    const positions: any[] = [];
                    for (const asset of SUPPORTED_ASSETS) {
                        const pos = await redis.hgetall(KEYS.position(address, asset.name));
                        if (pos && pos.size && parseFloat(pos.size) !== 0) {
                            positions.push({
                                coin: asset.name,
                                ...pos,
                            });
                        }
                    }

                    return {
                        marginSummary: {
                            accountValue: balance || '0',
                        },
                        assetPositions: positions,
                    };
                }

                case 'userFills': {
                    const user = body.user;
                    if (!user) return reply.status(400).send({ error: 'Missing user' });
                    const address = normalizeAddress(user);

                    const fillIds = await redis.lrange(KEYS.fills(address), 0, 99);
                    return fillIds.map((f: string) => {
                        try { return JSON.parse(f); } catch { return f; }
                    });
                }

                case 'meta': {
                    return {
                        universe: SUPPORTED_ASSETS.map((a, i) => ({
                            name: a.name,
                            szDecimals: a.szDecimals,
                            maxLeverage: 50,
                            onlyIsolated: false,
                        })),
                    };
                }

                default:
                    return reply.status(400).send({ error: `Unknown info type: ${type}` });
            }
        } catch (err) {
            return reply.status(500).send({ error: (err as Error).message });
        }
    });
}
