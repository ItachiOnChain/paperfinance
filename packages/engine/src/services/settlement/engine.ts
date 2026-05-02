/**
 * Settlement Engine — builds Merkle tree from Redis balances,
 * submits root on-chain, stores proof data.
 */

import { MerkleTree } from 'merkletreejs';
import { keccak256, encodePacked, type Hex } from 'viem';
import Decimal from 'decimal.js';
import { redis, KEYS } from '../../lib/redis';
import { publicClient, getWalletClient } from '../chain/viem-client';
import { VAULT_ABI } from '../chain/vault-abi';
import { normalizeAddress, type EvmAddress } from '../../lib/normalizeAddress';
import { config } from '../../config';

const USDC_DECIMALS = 6;

export interface BalanceEntry {
    address: EvmAddress;
    balance: string;        // Human-readable USDC (e.g. "1200.50")
    balanceMicro: bigint;   // Micro-units (e.g. 1200500000n)
}

export interface SettlementResult {
    epochId: number;
    merkleRoot: Hex;
    txHash: Hex;
    entries: BalanceEntry[];
    tree: MerkleTree;
}

/**
 * Scan all account balances from Redis.
 */
async function scanAllBalances(): Promise<BalanceEntry[]> {
    const entries: BalanceEntry[] = [];
    let cursor = '0';

    do {
        const [newCursor, keys] = await redis.scan(
            cursor, 'MATCH', 'account:*:balance', 'COUNT', 100,
        );
        cursor = newCursor;

        for (const key of keys) {
            // Extract address from key: account:{address}:balance
            const match = key.match(/^account:(0x[a-fA-F0-9]{40}):balance$/);
            if (!match) continue;

            const bal = await redis.get(key);
            if (!bal || parseFloat(bal) <= 0) continue;

            const address = normalizeAddress(match[1]);
            // Use decimal.js for precision: balance × 10^6 → integer
            const d = new Decimal(bal);
            const micro = d.mul(new Decimal(10).pow(USDC_DECIMALS)).floor();

            entries.push({
                address,
                balance: bal,
                balanceMicro: BigInt(micro.toFixed(0)),
            });
        }
    } while (cursor !== '0');

    return entries;
}

/**
 * Build a Merkle tree from balance entries.
 * Leaf = keccak256(keccak256(abi.encode(address, balanceMicro)))
 * (double-hash leaf encoding matching OpenZeppelin's MerkleProof)
 */
export function buildMerkleTree(entries: BalanceEntry[]): MerkleTree {
    const leaves = entries.map((e) => {
        const innerHash = keccak256(
            encodePacked(['address', 'uint256'], [e.address, e.balanceMicro]),
        );
        return keccak256(encodePacked(['bytes32'], [innerHash as `0x${string}`]));
    });

    // Sort pairs for deterministic tree (matching OpenZeppelin's behavior)
    return new MerkleTree(leaves, keccak256 as any, {
        sortPairs: true,
    });
}

/**
 * Get the Merkle proof for a specific address.
 */
export function getProof(
    tree: MerkleTree,
    address: EvmAddress,
    balanceMicro: bigint,
): Hex[] {
    const innerHash = keccak256(
        encodePacked(['address', 'uint256'], [address, balanceMicro]),
    );
    const leaf = keccak256(encodePacked(['bytes32'], [innerHash as `0x${string}`]));
    return tree.getHexProof(leaf) as Hex[];
}

/**
 * Run a full settlement:
 *   1. Scan balances from Redis
 *   2. Build Merkle tree
 *   3. Submit root on-chain via vault.settle()
 *   4. Wait for confirmation
 *   5. Store result in Redis
 */
export async function runSettlement(epochId: number): Promise<SettlementResult> {
    console.log(`[Settlement] Starting epoch ${epochId}...`);

    // 1. Scan all balances
    const entries = await scanAllBalances();
    if (entries.length === 0) {
        throw new Error('No accounts with positive balances');
    }
    console.log(`[Settlement] Found ${entries.length} accounts`);

    // 2. Build Merkle tree
    const tree = buildMerkleTree(entries);
    const merkleRoot = tree.getHexRoot() as Hex;
    console.log(`[Settlement] Merkle root: ${merkleRoot}`);

    // 3. Submit on-chain
    const walletClient = getWalletClient();
    const vaultAddress = config.VAULT_ADDRESS as `0x${string}`;

    const txHash = await walletClient.writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'settle',
        args: [merkleRoot as `0x${string}`],
    });
    console.log(`[Settlement] TX submitted: ${txHash}`);

    // 4. Wait for 2 confirmations
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
    });
    console.log(`[Settlement] Confirmed in block ${receipt.blockNumber}`);

    // 5. Store in Redis
    const data = {
        epochId: epochId.toString(),
        merkleRoot,
        txHash,
        blockNumber: receipt.blockNumber.toString(),
        accountCount: entries.length.toString(),
        timestamp: Date.now().toString(),
        // Store entries as JSON for proof reconstruction
        entries: JSON.stringify(
            entries.map((e) => ({
                address: e.address,
                balance: e.balance,
                balanceMicro: e.balanceMicro.toString(),
            })),
        ),
    };

    await redis.hset(KEYS.settlementKey(epochId), data);
    await redis.set('settlement:latest', epochId.toString());

    const result: SettlementResult = { epochId, merkleRoot, txHash, entries, tree };
    console.log(`[Settlement] Epoch ${epochId} complete ✓`);
    return result;
}
