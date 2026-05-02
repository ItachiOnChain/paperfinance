/**
 * Risk Engine — orchestrates margin tracking, liquidation, and funding.
 *
 * Boots three sub-services:
 *   1. MarginTracker  — tick subscriber, scans positions
 *   2. LiquidationExecutor — BRPOP worker, processes queue
 *   3. FundingCron    — hourly funding rate settlement
 */

import { MarginTracker } from './margin-tracker';
import { LiquidationExecutor } from './liquidation-executor';
import { FundingCron } from './funding-cron';
import type { MarketDataAdapter } from '../../adapters/market-data';
import type { Tick } from '../../types/index';

export class RiskEngine {
    private tracker: MarginTracker;
    private executor: LiquidationExecutor;
    private funding: FundingCron;
    private adapter: MarketDataAdapter;

    constructor(adapter: MarketDataAdapter, fundingIntervalMs?: number) {
        this.adapter = adapter;
        this.tracker = new MarginTracker();
        this.executor = new LiquidationExecutor();
        this.funding = new FundingCron(fundingIntervalMs);
    }

    async start(): Promise<void> {
        console.log('[RiskEngine] ────────────────────────────────');
        console.log('[RiskEngine] Starting risk engine...');

        // 1. Start margin tracker
        this.tracker.start();

        // Subscribe tracker to market data ticks
        this.adapter.onTick(async (tick: Tick) => {
            try {
                await this.tracker.onTick(tick);
            } catch (err) {
                console.error('[RiskEngine] margin tracker tick error:', err);
            }
        });

        // 2. Start liquidation executor (async BRPOP loop)
        await this.executor.start();

        // 3. Start funding cron
        this.funding.start();

        console.log('[RiskEngine] All risk services operational ✓');
        console.log('[RiskEngine] ────────────────────────────────');
    }

    stop(): void {
        this.tracker.stop();
        this.executor.stop();
        this.funding.stop();
        console.log('[RiskEngine] stopped');
    }

    /** Expose tracker for testing */
    getTracker(): MarginTracker {
        return this.tracker;
    }
}
