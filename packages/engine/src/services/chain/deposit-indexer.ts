/**
 * Deposit Indexer — polls 0G chain for Deposited events.
 *
 * Uses getLogs polling (NOT event listeners) for restart safety.
 * Processes events idempotently using Redis SET NX for dedup.
 * Credits accounts using atomic Lua script.
 */

import { parseAbiItem, type Log } from 'viem';
import { publicClient } from './viem-client';
import { redis, KEYS } from '../../lib/redis';
import { normalizeAddress } from '../../lib/normalizeAddress';
import { config } from '../../config';

const POLL_INTERVAL_MS = 2000;
const MAX_BLOCK_RANGE = 500;
const DEPOSIT_DEDUP_TTL = 2_592_000; // 30 days in seconds
const USDC_DECIMALS = 6;

// Deposited(address indexed user, uint256 amount)
const DEPOSITED_EVENT = parseAbiItem(
    'event Deposited(address indexed user, uint256 amount)',
);

/**
 * Convert raw uint256 amount (6 decimals) to USDC string.
 */
function amountToUsdc(raw: bigint): string {
    const whole = raw / BigInt(10 ** USDC_DECIMALS);
    const frac = raw % BigInt(10 ** USDC_DECIMALS);
    const fracStr = frac.toString().padStart(USDC_DECIMALS, '0');
    return `${whole}.${fracStr}`;
}

/**
 * Start the deposit indexer polling loop.
 * Returns a cleanup function to stop polling.
 */
export function startDepositIndexer(): () => void {
    let running = true;

    const vaultAddress = config.VAULT_ADDRESS as `0x${string}`;
    if (!vaultAddress || vaultAddress === '0x') {
        console.warn('[DepositIndexer] VAULT_ADDRESS not set — indexer disabled');
        return () => { running = false; };
    }

    console.log(`[DepositIndexer] Monitoring vault ${vaultAddress} on chain ${config.OG_CHAIN_ID}`);

    const poll = async () => {
        while (running) {
            try {
                await pollOnce(vaultAddress);
            } catch (err) {
                console.error('[DepositIndexer] Poll error:', (err as Error).message);
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
    };

    // Fire and forget — runs as background task
    poll();

    return () => {
        running = false;
        console.log('[DepositIndexer] Stopped');
    };
}

async function pollOnce(vaultAddress: `0x${string}`): Promise<void> {
    // Read last processed block
    const lastBlockStr = await redis.get(KEYS.indexerLastBlock);
    const lastBlock = lastBlockStr ? BigInt(lastBlockStr) : BigInt(0);

    // Get current block
    const currentBlock = await publicClient.getBlockNumber();

    if (currentBlock <= lastBlock) return;

    // Clamp range to MAX_BLOCK_RANGE
    const fromBlock = lastBlock + 1n;
    const toBlock = currentBlock - fromBlock > BigInt(MAX_BLOCK_RANGE)
        ? fromBlock + BigInt(MAX_BLOCK_RANGE)
        : currentBlock;

    // Query Deposited events
    const logs = await publicClient.getLogs({
        address: vaultAddress,
        event: DEPOSITED_EVENT,
        fromBlock,
        toBlock,
    });

    if (logs.length > 0) {
        console.log(`[DepositIndexer] Found ${logs.length} deposits in blocks ${fromBlock}-${toBlock}`);
    }

    // Process each log
    for (const log of logs) {
        await processDepositLog(log);
    }

    // Update last processed block
    await redis.set(KEYS.indexerLastBlock, toBlock.toString());
}

async function processDepositLog(log: Log<bigint, number, false, typeof DEPOSITED_EVENT>): Promise<void> {
    const txHash = log.transactionHash;
    if (!txHash) return;

    const user = normalizeAddress(log.args.user as string);
    const amount = log.args.amount as bigint;
    const usdcAmount = amountToUsdc(amount);

    // Idempotency check: SET NX with 30-day TTL
    const isNew = await redis.set(
        KEYS.depositKey(txHash),
        '1',
        'EX',
        DEPOSIT_DEDUP_TTL,
        'NX',
    );

    if (!isNew) {
        // Already processed
        return;
    }

    // Credit account balance via Lua script
    const balKey = KEYS.balance(user);
    const streamKey = `account:${user}:deposits`;
    const blockNum = log.blockNumber?.toString() ?? '0';
    const timestamp = Date.now().toString();

    await (redis as any).creditDeposit(
        balKey,
        streamKey,
        usdcAmount,
        txHash,
        blockNum,
        timestamp,
    );

    console.log(`[DepositIndexer] Credited ${usdcAmount} USDC to ${user} (tx: ${txHash.slice(0, 10)}...)`);
}
