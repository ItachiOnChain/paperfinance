/**
 * SIWE (Sign-In With Ethereum) authentication.
 *
 * POST /auth/nonce?address=0x... → generate + store nonce (5 min TTL)
 * POST /auth/verify { message, signature } → verify SIWE message → issue JWT
 * authenticate preHandler → extract JWT → attach req.uid
 */

import { SiweMessage } from 'siwe';
import jwt from 'jsonwebtoken';
import { redis, KEYS } from '../../lib/redis';
import { normalizeAddress, type EvmAddress } from '../../lib/normalizeAddress';
import { config } from '../../config';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const JWT_EXPIRY = '24h';
const NONCE_TTL = 300; // 5 minutes

/** Generate a random nonce string */
function generateNonce(): string {
    return randomBytes(16).toString('hex');
}

/** Get or create JWT secret (use config, fallback to random for dev) */
function getJwtSecret(): string {
    if (config.JWT_SECRET && config.JWT_SECRET.length > 0) {
        return config.JWT_SECRET;
    }
    console.warn('[SIWE] No JWT_SECRET set — using random secret (sessions won\'t survive restarts)');
    return randomBytes(32).toString('hex');
}

const jwtSecret = getJwtSecret();

// ── Fastify type augmentation ──────────────────────────────
declare module 'fastify' {
    interface FastifyRequest {
        uid: EvmAddress;
    }
}

/**
 * Register SIWE auth routes on a Fastify instance.
 */
export function registerAuthRoutes(app: FastifyInstance): void {
    // POST /auth/nonce?address=0x...
    app.post('/auth/nonce', async (req: FastifyRequest, reply: FastifyReply) => {
        const address = (req.query as any)?.address;
        if (!address || typeof address !== 'string') {
            return reply.status(400).send({ error: 'Missing ?address=0x...' });
        }

        let normalized: EvmAddress;
        try {
            normalized = normalizeAddress(address);
        } catch {
            return reply.status(400).send({ error: 'Invalid EVM address' });
        }

        const nonce = generateNonce();
        await redis.set(KEYS.siweNonce(normalized), nonce, 'EX', NONCE_TTL);

        return { nonce };
    });

    // POST /auth/verify { message: string, signature: string }
    app.post('/auth/verify', async (req: FastifyRequest, reply: FastifyReply) => {
        const body = req.body as { message?: string; signature?: string } | undefined;
        if (!body?.message || !body?.signature) {
            return reply.status(400).send({ error: 'Missing message or signature' });
        }

        let siweMsg: SiweMessage;
        try {
            siweMsg = new SiweMessage(body.message);
        } catch {
            return reply.status(400).send({ error: 'Invalid SIWE message' });
        }

        const address = normalizeAddress(siweMsg.address);

        // Check nonce
        const storedNonce = await redis.get(KEYS.siweNonce(address));
        if (!storedNonce || storedNonce !== siweMsg.nonce) {
            return reply.status(401).send({ error: 'Nonce mismatch or expired' });
        }

        // Verify signature
        try {
            await siweMsg.verify({ signature: body.signature });
        } catch (err) {
            return reply.status(401).send({ error: `Signature verification failed: ${(err as Error).message}` });
        }

        // Delete used nonce
        await redis.del(KEYS.siweNonce(address));

        // Issue JWT
        const token = jwt.sign(
            { sub: address },
            jwtSecret,
            { expiresIn: JWT_EXPIRY },
        );

        return { token, address };
    });
}

/**
 * Fastify preHandler hook to authenticate requests.
 * Extracts JWT from Authorization: Bearer header.
 * Attaches req.uid as checksummed EVM address.
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({ error: 'Missing Authorization: Bearer token' });
        return;
    }

    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, jwtSecret) as { sub: string };
        req.uid = normalizeAddress(payload.sub);
    } catch {
        reply.status(401).send({ error: 'Invalid or expired token' });
    }
}
