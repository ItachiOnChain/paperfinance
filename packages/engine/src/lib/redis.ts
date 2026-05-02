/**
 * Redis client singleton with embedded Lua fill script.
 *
 * Uses ioredis defineCommand to register the fill-order Lua script,
 * exposing `redis.fillOrder(...)` as a first-class method.
 */

import Redis from 'ioredis';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

// ── Resolve Lua script path ────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const FILL_LUA = readFileSync(
    resolve(__dirname, 'lua', 'fill-order.lua'),
    'utf-8',
);
const LIQUIDATE_LUA = readFileSync(
    resolve(__dirname, 'lua', 'liquidate-position.lua'),
    'utf-8',
);
const FUNDING_LUA = readFileSync(
    resolve(__dirname, 'lua', 'funding-payment.lua'),
    'utf-8',
);
const CREDIT_DEPOSIT_LUA = readFileSync(
    resolve(__dirname, 'lua', 'credit-deposit.lua'),
    'utf-8',
);

// ── Redis key schema ───────────────────────────────────────
export const KEYS = {
    balance: (uid: string) => `account:${uid}:balance`,
    position: (uid: string, symbol: string) => `account:${uid}:positions:${symbol}`,
    openOrders: (uid: string) => `orders:${uid}:open`,
    history: (uid: string) => `orders:${uid}:history`,
    fills: (uid: string) => `fills:${uid}`,
    orderData: (orderId: string) => `order:${orderId}`,
    marketMid: (symbol: string) => `market:mid:${symbol}`,
    liquidationQueue: 'liquidation:queue',
    fundingStream: (uid: string) => `account:${uid}:funding`,
    positionPattern: (symbol: string) => `account:*:positions:${symbol}`,
    // ── Blockchain integration ─────────────────────────────────
    siweNonce: (address: string) => `siwe:nonce:${address}`,
    indexerLastBlock: 'indexer:lastBlock',
    depositKey: (txHash: string) => `deposit:${txHash}`,
    settlementKey: (epochId: number) => `settlement:epoch:${epochId}`,
} as const;

// ── Create client ──────────────────────────────────────────
const url = new URL(config.REDIS_URL);
const isTls = url.protocol === 'rediss:';

export const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
});

// ── Register Lua commands ──────────────────────────────────
redis.defineCommand('fillOrder', {
    numberOfKeys: 5,
    lua: FILL_LUA,
});

redis.defineCommand('liquidatePosition', {
    numberOfKeys: 4,
    lua: LIQUIDATE_LUA,
});

redis.defineCommand('fundingPayment', {
    numberOfKeys: 2,
    lua: FUNDING_LUA,
});

redis.defineCommand('creditDeposit', {
    numberOfKeys: 2,
    lua: CREDIT_DEPOSIT_LUA,
});

// Augment the Redis type so TS knows about custom commands
declare module 'ioredis' {
    interface Redis {
        fillOrder(
            balanceKey: string,
            positionKey: string,
            openKey: string,
            historyKey: string,
            fillsKey: string,
            orderId: string,
            fillPrice: string,
            fillSize: string,
            side: string,
            fee: string,
            realizedPnl: string,
            newPositionSize: string,
            newEntryPrice: string,
            fillJson: string,
            orderScore: string,
            timestamp: string,
        ): Promise<number>;

        liquidatePosition(
            balanceKey: string,
            positionKey: string,
            openKey: string,
            fillsKey: string,
            uid: string,
            symbol: string,
            side: string,
            size: string,
            liquidationPrice: string,
            finalPnl: string,
            fee: string,
            fillJson: string,
            timestamp: string,
        ): Promise<number>;

        fundingPayment(
            balanceKey: string,
            fundingKey: string,
            uid: string,
            symbol: string,
            payment: string,
            fundingRate: string,
            notional: string,
            timestamp: string,
        ): Promise<number>;

        creditDeposit(
            balanceKey: string,
            streamKey: string,
            amount: string,
            txHash: string,
            blockNum: string,
            timestamp: string,
        ): Promise<string>;
    }
}

// ── Lifecycle ──────────────────────────────────────────────
export async function connectRedis(): Promise<void> {
    await redis.connect();
    await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
    await redis.quit();
}

