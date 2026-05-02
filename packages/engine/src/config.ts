import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath) && typeof (process as any).loadEnvFile === 'function') {
  (process as any).loadEnvFile(envPath);
}

const envSchema = z.object({
  // ── 0G Chain ──────────────────────────────────────────────
  OG_RPC_URL: z.string().default('https://evmrpc-testnet.0g.ai'),
  OG_WS_RPC_URL: z.string().default('wss://evmrpc-testnet.0g.ai/ws'),
  OG_CHAIN_ID: z.coerce.number().default(16602),
  VAULT_ADDRESS: z.string().default('0xeeb5b70562e52cbcd6204d666b7fe36284f6b891'),

  // ── Market Data ───────────────────────────────────────────
  BINANCE_WS_URL: z.string().default('wss://stream.binance.com:9443/ws'),

  // ── Data Stores ───────────────────────────────────────────
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ── Auth / Security ───────────────────────────────────────
  JWT_SECRET: z.string().default(''),
  DEPLOYER_PK: z.string().default(''),

  // ── Server ────────────────────────────────────────────────
  PORT: z.coerce.number().default(3001),
  DEFAULT_BALANCE: z.coerce.number().default(100_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── WebSocket Reconnect ───────────────────────────────────
  WS_RECONNECT_MIN_MS: z.coerce.number().default(1000),
  WS_RECONNECT_MAX_MS: z.coerce.number().default(30000),

  // ── Rate Limiting ─────────────────────────────────────────
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // ── Fees ──────────────────────────────────────────────────
  FEES_ENABLED: z.coerce.boolean().default(true),
  FEE_RATE_TAKER: z.string().default('0.00035'),
  FEE_RATE_MAKER: z.string().default('0.0001'),
  FUNDING_ENABLED: z.coerce.boolean().default(true),
  FUNDING_INTERVAL_MS: z.coerce.number().default(28_800_000),

  // ── Demo Mode ─────────────────────────────────────────────
  DEMO_MODE_SECRET: z.string().default(''),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
