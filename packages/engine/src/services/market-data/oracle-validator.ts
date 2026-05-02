/**
 * OracleValidator — cross-validates WebSocket prices against
 * on-chain oracle prices.
 *
 * getValidatedPrice(symbol):
 *   1. Read WS price from Redis (price:{symbol})
 *   2. Read on-chain oracle price via viem readContract
 *   3. If WS price missing/expired → throw StalePriceError
 *   4. If deviation > 0.5% → log warning, return oracle price
 *   5. Otherwise → return WS price (faster)
 */

import { redis } from '../../lib/redis';
import { createPublicClient, http, type PublicClient, type Abi } from 'viem';
import { config } from '../../config';

// ── Error types ────────────────────────────────────────────
export class StalePriceError extends Error {
    constructor(symbol: string) {
        super(`[StalePriceError] No fresh WS price for ${symbol} — key expired or missing`);
        this.name = 'StalePriceError';
    }
}

// ── Deviation threshold ────────────────────────────────────
const MAX_DEVIATION_PCT = 0.5; // 0.5%

// ── Redis price key ────────────────────────────────────────
const PRICE_KEY = (symbol: string) => `price:${symbol}`;

// ── Oracle contract ABI (minimal, for getPrice) ────────────
const ORACLE_ABI = [
    {
        name: 'getPrice',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'asset', type: 'string' }],
        outputs: [{ name: 'price', type: 'int256' }],
    },
] as const satisfies Abi;

// ── Viem public client (lazy init) ─────────────────────────
let client: PublicClient | null = null;

function getClient(): PublicClient {
    if (!client) {
        client = createPublicClient({
            transport: http(config.OG_RPC_URL),
        });
    }
    return client;
}

// ── Oracle contract address ────────────────────────────────
// In production, set via env. Empty = oracle validation disabled.
function getOracleAddress(): `0x${string}` | null {
    const addr = process.env.ORACLE_CONTRACT_ADDRESS || '';
    if (!addr || addr === '' || addr === '0x') return null;
    return addr as `0x${string}`;
}

/**
 * Read the on-chain oracle price for a symbol.
 * Returns null if oracle contract is not configured.
 */
export async function getOraclePrice(symbol: string): Promise<number | null> {
    const address = getOracleAddress();
    if (!address) return null;

    try {
        const result = await getClient().readContract({
            address,
            abi: ORACLE_ABI,
            functionName: 'getPrice',
            args: [symbol],
        });

        // Result is int256 with 8 decimal places (Chainlink-style)
        return Number(result) / 1e8;
    } catch (err) {
        console.warn(`[OracleValidator] readContract failed for ${symbol}:`, err);
        return null;
    }
}

/**
 * Get validated price for a symbol.
 *
 * Priority: WS price (fast) > oracle price (authoritative).
 * Cross-validates if both are available.
 */
export async function getValidatedPrice(symbol: string): Promise<number> {
    // 1. Read WS price from Redis
    const wsPrice = await redis.get(PRICE_KEY(symbol));

    // 2. Read oracle price (if configured)
    const oraclePrice = await getOraclePrice(symbol);

    // 3. If WS price is missing/expired
    if (!wsPrice) {
        if (oraclePrice !== null) {
            console.warn(`[OracleValidator] WS price stale for ${symbol}, using oracle: ${oraclePrice}`);
            return oraclePrice;
        }
        throw new StalePriceError(symbol);
    }

    const wsPriceNum = parseFloat(wsPrice);

    // 4. If oracle available, check deviation
    if (oraclePrice !== null && oraclePrice > 0) {
        const deviation = Math.abs(wsPriceNum - oraclePrice) / oraclePrice * 100;

        if (deviation > MAX_DEVIATION_PCT) {
            console.warn(
                `[OracleValidator] Price deviation for ${symbol}: ` +
                `WS=${wsPriceNum} oracle=${oraclePrice} deviation=${deviation.toFixed(3)}% ` +
                `— using oracle price`,
            );
            return oraclePrice;
        }
    }

    // 5. WS price is fresh and within tolerance
    return wsPriceNum;
}

/**
 * Inject a custom viem client (for testing with mock contracts).
 */
export function setOracleClient(c: PublicClient): void {
    client = c;
}
