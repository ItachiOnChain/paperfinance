#!/usr/bin/env bun
/**
 * check-env.ts — Validates all required env vars and makes a one-shot
 * eth_blockNumber call to the configured OG_RPC_URL.
 *
 * Usage:
 *   bun run scripts/check-env.ts
 *
 * Exits 0 on success, 1 on failure.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Load .env ──────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile(envPath);
}

// ── Required env vars ──────────────────────────────────────────────
const REQUIRED_VARS = [
    'OG_RPC_URL',
    'OG_WS_RPC_URL',
    'OG_CHAIN_ID',
    'BINANCE_WS_URL',
    'REDIS_URL',
    'DATABASE_URL',
    'JWT_SECRET',
    'DEPLOYER_PK',
    'VAULT_ADDRESS',
    'LOG_LEVEL',
] as const;

console.log('🔍  Checking environment variables...\n');

const missing: string[] = [];

for (const key of REQUIRED_VARS) {
    const val = process.env[key];
    if (!val || val.trim() === '') {
        missing.push(key);
        console.log(`  ❌  ${key} — NOT SET`);
    } else {
        // Mask sensitive values
        const masked = ['DEPLOYER_PK', 'JWT_SECRET'].includes(key)
            ? val.slice(0, 6) + '…' + val.slice(-4)
            : val;
        console.log(`  ✅  ${key} = ${masked}`);
    }
}

console.log('');

if (missing.length > 0) {
    console.error(
        `🚫  ${missing.length} required variable(s) missing: ${missing.join(', ')}\n` +
        '   Copy .env.example to .env and fill in the blanks.'
    );
    process.exit(1);
}

// ── One-shot eth_blockNumber RPC call ──────────────────────────────
const rpcUrl = process.env.OG_RPC_URL!;
console.log(`⛓️   Calling eth_blockNumber on ${rpcUrl} …\n`);

try {
    const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
        }),
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as { result?: string; error?: { message: string } };

    if (json.error) {
        throw new Error(`RPC error: ${json.error.message}`);
    }

    const blockHex = json.result!;
    const blockNumber = parseInt(blockHex, 16);

    console.log(`  ✅  Current 0G block number: ${blockNumber} (${blockHex})`);
    console.log('\n🎉  All checks passed — environment is ready!\n');
} catch (err) {
    console.error(`\n🚫  RPC call failed: ${(err as Error).message}`);
    console.error('   Verify OG_RPC_URL is reachable and correct.\n');
    process.exit(1);
}
