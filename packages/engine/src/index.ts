/**
 * Entry point — boots Redis, Fastify, and the matching engine.
 *
 * ALWAYS uses BinanceAdapter for real market data — no mock fallback.
 * Demo mode adds bots and scenarios on top of live Binance prices.
 */

import { connectRedis } from './lib/redis';
import { startServer } from './server';
import { MatchingEngine } from './services/matching/engine';
import { BinanceAdapter } from './services/market-data/binance-adapter';
import { StalePriceGuard } from './services/market-data/stale-price-guard';
import { startDepositIndexer } from './services/chain/deposit-indexer';
import { DemoController } from './lib/demo/demo-controller';

async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('  HyPaper 0G — Paper Trading Engine');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Connect to Redis
    console.log('[Boot] Connecting to Redis...');
    await connectRedis();
    console.log('[Boot] Redis connected ✓\n');

    // 2. Connect to Binance (always real data)
    console.log('[Boot] Connecting to Binance (live market data)...');
    const binance = new BinanceAdapter(['btcusdt', 'ethusdt']);
    const guard = new StalePriceGuard();
    const stopStaleMonitor = guard.startMonitor(1000);

    try {
        await binance.connect();
        console.log('[Boot] Binance connected ✓');
    } catch (err) {
        console.error(`[Boot] ✗ Binance connection failed: ${(err as Error).message}`);
        console.error('[Boot] Retrying in background — engine will start without initial price data');
    }

    // 3. Create matching engine
    console.log('[Boot] Starting matching engine...');
    const engine = new MatchingEngine(binance);
    await engine.start();
    console.log('[Boot] Matching engine started ✓');

    // 4. Create demo controller (uses real Binance prices from Redis)
    const demo = new DemoController(engine);

    // 5. Start HTTP + WebSocket server
    console.log('[Boot] Starting HTTP + WebSocket server...');
    await startServer(engine, demo);

    // 6. Start deposit indexer (background)
    console.log('[Boot] Starting deposit indexer...');
    const stopIndexer = startDepositIndexer();
    console.log('[Boot] Deposit indexer started ✓');

    console.log('\n[Boot] All systems operational ✓\n');

    // Keep-alive
    const keepAlive = setInterval(() => { }, 30_000);

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n[Shutdown] Stopping...');
        demo.stop();
        engine.stop();
        stopIndexer();
        stopStaleMonitor();
        clearInterval(keepAlive);
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// ── Process crash guards ──────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[CRASH] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[CRASH] Unhandled rejection:', reason);
});

main().catch((err) => {
    console.error('[Fatal]', err);
    process.exit(1);
});
