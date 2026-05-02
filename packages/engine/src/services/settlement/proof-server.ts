/**
 * Merkle Proof Server — serves GET /account/proof?address=0x...
 *
 * Reads the latest settlement epoch from Redis,
 * reconstructs the Merkle tree, and returns the proof.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis, KEYS } from '../../lib/redis';
import { normalizeAddress, type EvmAddress } from '../../lib/normalizeAddress';
import { buildMerkleTree, getProof, type BalanceEntry } from './engine';

/**
 * Register the proof endpoint on a Fastify instance.
 */
export function registerProofRoutes(app: FastifyInstance): void {
    app.get('/account/proof', async (req: FastifyRequest, reply: FastifyReply) => {
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

        // Get latest epoch
        const latestEpochStr = await redis.get('settlement:latest');
        if (!latestEpochStr) {
            return reply.status(404).send({ error: 'No settlement epoch found' });
        }

        const epochId = parseInt(latestEpochStr, 10);
        const epochData = await redis.hgetall(KEYS.settlementKey(epochId));

        if (!epochData || !epochData.entries) {
            return reply.status(404).send({ error: `Epoch ${epochId} data not found` });
        }

        // Parse entries and find user
        const entries: BalanceEntry[] = JSON.parse(epochData.entries).map(
            (e: any) => ({
                address: e.address as EvmAddress,
                balance: e.balance,
                balanceMicro: BigInt(e.balanceMicro),
            }),
        );

        const userEntry = entries.find((e) => e.address === normalized);
        if (!userEntry) {
            return reply.status(404).send({ error: 'Address not found in settlement' });
        }

        // Rebuild tree and get proof
        const tree = buildMerkleTree(entries);
        const proof = getProof(tree, normalized, userEntry.balanceMicro);

        return {
            epochId,
            address: normalized,
            finalBalance: userEntry.balance,
            finalBalanceMicro: userEntry.balanceMicro.toString(),
            merkleRoot: epochData.merkleRoot,
            proof,
        };
    });
}
