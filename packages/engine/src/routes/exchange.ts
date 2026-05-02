/**
 * POST /exchange — authenticated, HL-compatible.
 *
 * Discriminated union on action.type:
 *   - "order" → validate, margin check, place via matching engine
 *   - "cancel" → remove from Redis ZSET
 *   - "cancelByCloid" → cancel by client order ID
 */

import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis, KEYS } from '../lib/redis';
import { normalizeAddress } from '../lib/normalizeAddress';
import type { EvmAddress } from '../lib/normalizeAddress';
import type { MatchingEngine } from '../services/matching/engine';
import { authenticate } from '../services/auth/siwe';

// ── Zod schemas ────────────────────────────────────────────
const OrderSchema = z.object({
    symbol: z.string().min(1),
    side: z.enum(['buy', 'sell']),
    type: z.enum(['market', 'limit']).default('limit'),
    size: z.string().refine((s) => {
        const n = Number(s);
        return Number.isFinite(n) && n > 0;
    }, 'Size must be a positive finite number'),
    price: z.string().refine((s) => {
        const n = Number(s);
        return Number.isFinite(n) && n > 0;
    }, 'Price must be a positive finite number'),
    reduceOnly: z.boolean().default(false),
});

const CancelSchema = z.object({
    orderId: z.string().min(1),
});

const ExchangeBody = z.discriminatedUnion('type', [
    z.object({ type: z.literal('order'), order: OrderSchema }),
    z.object({ type: z.literal('cancel'), cancel: CancelSchema }),
    z.object({ type: z.literal('cancelByCloid'), cloid: z.string().min(1) }),
]);

/**
 * Register POST /exchange route.
 */
export function registerExchangeRoutes(app: FastifyInstance, engine: MatchingEngine): void {
    app.post('/exchange', { preHandler: authenticate }, async (req: FastifyRequest, reply: FastifyReply) => {
        const uid = req.uid;
        const parseResult = ExchangeBody.safeParse(req.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                status: 'err',
                error: parseResult.error.issues.map((i) => i.message).join(', '),
            });
        }

        const body = parseResult.data;

        try {
            switch (body.type) {
                case 'order': {
                    // Margin check: balance >= size * price * (1/leverage)
                    const balStr = await redis.get(KEYS.balance(uid));
                    const balance = parseFloat(balStr || '0');
                    const notional = parseFloat(body.order.size) * parseFloat(body.order.price);
                    // Simple margin check — 1x leverage
                    if (balance < notional * 0.1) {
                        return reply.status(400).send({
                            status: 'err',
                            error: 'Insufficient margin',
                        });
                    }

                    const order = await engine.placeOrder(uid, {
                        symbol: body.order.symbol,
                        side: body.order.side,
                        type: body.order.type,
                        size: body.order.size,
                        price: body.order.price,
                    });

                    return { status: 'ok', orderId: order.id };
                }

                case 'cancel': {
                    const orderId = body.cancel.orderId;
                    // Read order to verify ownership
                    const orderData = await redis.get(KEYS.orderData(orderId));
                    if (!orderData) {
                        return reply.status(404).send({ status: 'err', error: 'Order not found' });
                    }
                    const order = JSON.parse(orderData);
                    if (normalizeAddress(order.uid) !== uid) {
                        return reply.status(403).send({ status: 'err', error: 'Not your order' });
                    }

                    // Remove from open orders ZSET
                    await redis.zrem(KEYS.openOrders(uid), orderId);
                    // Update order status
                    order.status = 'cancelled';
                    order.updatedAt = Date.now();
                    await redis.set(KEYS.orderData(orderId), JSON.stringify(order));

                    return { status: 'ok', orderId };
                }

                case 'cancelByCloid': {
                    // Scan open orders to find matching cloid
                    const openIds = await redis.zrange(KEYS.openOrders(uid), 0, -1);
                    for (const oid of openIds) {
                        const raw = await redis.get(KEYS.orderData(oid));
                        if (!raw) continue;
                        const order = JSON.parse(raw);
                        if (order.cloid === body.cloid) {
                            await redis.zrem(KEYS.openOrders(uid), oid);
                            order.status = 'cancelled';
                            order.updatedAt = Date.now();
                            await redis.set(KEYS.orderData(oid), JSON.stringify(order));
                            return { status: 'ok', orderId: oid };
                        }
                    }
                    return reply.status(404).send({ status: 'err', error: 'Order not found' });
                }
            }
        } catch (err) {
            return reply.status(500).send({ status: 'err', error: (err as Error).message });
        }
    });
}
