/**
 * ScenarioRunner — plays timed trading scenarios using real Binance prices.
 *
 * Price shocks are applied via PriceOverlay (temporary Redis overwrites
 * that get naturally overwritten by the next Binance tick).
 *
 * Scenarios:
 *   btcCrash        — BTC drops ~15% over 30s
 *   altcoinMoon     — ETH pumps ~20% over 20s
 *   fundingHarvest  — open long, wait, close with funding profit
 *   multiSymbolHedge — long BTC + short ETH simultaneously
 */

import type { PriceOverlay } from './price-overlay';
import type { MatchingEngine } from '../../services/matching/engine';
import { redis, KEYS } from '../../lib/redis';
import { normalizeAddress } from '../../lib/normalizeAddress';

const SCENARIO_ACCOUNT = normalizeAddress('0x0000000000000000000000000000000000000001');

export type ScenarioName = 'btcCrash' | 'altcoinMoon' | 'fundingHarvest' | 'multiSymbolHedge';

interface ScenarioStep {
    delayMs: number;
    action: () => Promise<void> | void;
}

export class ScenarioRunner {
    private overlay: PriceOverlay;
    private engine: MatchingEngine;
    private timers: ReturnType<typeof setTimeout>[] = [];
    private running = false;

    constructor(overlay: PriceOverlay, engine: MatchingEngine) {
        this.overlay = overlay;
        this.engine = engine;
    }

    async run(scenario: ScenarioName): Promise<void> {
        this.stop();
        this.running = true;
        console.log(`[Scenario] Playing: ${scenario}`);

        // Ensure scenario account has balance
        await redis.set(KEYS.balance(SCENARIO_ACCOUNT), '50000');

        const steps = this.getSteps(scenario);
        let elapsed = 0;
        for (const step of steps) {
            elapsed += step.delayMs;
            const timer = setTimeout(async () => {
                if (!this.running) return;
                try { await step.action(); } catch (e) { console.warn('[Scenario] Step error:', e); }
            }, elapsed);
            this.timers.push(timer);
        }
    }

    stop(): void {
        this.running = false;
        for (const t of this.timers) clearTimeout(t);
        this.timers = [];
        this.overlay.clearShocks();
    }

    private getSteps(scenario: ScenarioName): ScenarioStep[] {
        switch (scenario) {
            case 'btcCrash': return this.btcCrash();
            case 'altcoinMoon': return this.altcoinMoon();
            case 'fundingHarvest': return this.fundingHarvest();
            case 'multiSymbolHedge': return this.multiSymbolHedge();
        }
    }

    private async getPrice(symbol: string): Promise<string> {
        const p = await this.overlay.getPrice(symbol);
        return p > 0 ? p.toFixed(2) : '96000';
    }

    private btcCrash(): ScenarioStep[] {
        return [
            { delayMs: 0, action: () => console.log('[Scenario] BTC Flash Crash starting...') },
            {
                delayMs: 1000, action: async () => this.engine.placeOrder(SCENARIO_ACCOUNT, {
                    symbol: 'BTC-PERP', side: 'buy', type: 'limit', size: '0.5',
                    price: await this.getPrice('BTC-PERP'),
                })
            },
            { delayMs: 5000, action: () => this.overlay.shock('BTC-PERP', -3, 8000) },
            { delayMs: 5000, action: () => this.overlay.shock('BTC-PERP', -4, 8000) },
            { delayMs: 5000, action: () => this.overlay.shock('BTC-PERP', -3, 8000) },
            { delayMs: 5000, action: () => this.overlay.shock('BTC-PERP', -3, 8000) },
            { delayMs: 5000, action: () => this.overlay.shock('BTC-PERP', -2, 8000) },
            { delayMs: 5000, action: () => this.overlay.clearShocks() },
            { delayMs: 3000, action: () => console.log('[Scenario] BTC Flash Crash completed') },
        ];
    }

    private altcoinMoon(): ScenarioStep[] {
        return [
            { delayMs: 0, action: () => console.log('[Scenario] Altcoin Moon starting...') },
            {
                delayMs: 1000, action: async () => this.engine.placeOrder(SCENARIO_ACCOUNT, {
                    symbol: 'ETH-PERP', side: 'buy', type: 'limit', size: '5',
                    price: await this.getPrice('ETH-PERP'),
                })
            },
            { delayMs: 3000, action: () => this.overlay.shock('ETH-PERP', 4, 6000) },
            { delayMs: 4000, action: () => this.overlay.shock('ETH-PERP', 5, 6000) },
            { delayMs: 4000, action: () => this.overlay.shock('ETH-PERP', 5, 6000) },
            { delayMs: 4000, action: () => this.overlay.shock('ETH-PERP', 3, 6000) },
            { delayMs: 4000, action: () => { this.overlay.clearShocks(); console.log('[Scenario] Altcoin Moon completed'); } },
        ];
    }

    private fundingHarvest(): ScenarioStep[] {
        return [
            { delayMs: 0, action: () => console.log('[Scenario] Funding Harvest starting...') },
            {
                delayMs: 1000, action: async () => this.engine.placeOrder(SCENARIO_ACCOUNT, {
                    symbol: 'BTC-PERP', side: 'buy', type: 'limit', size: '0.2',
                    price: await this.getPrice('BTC-PERP'),
                })
            },
            { delayMs: 10000, action: () => console.log('[Scenario] Waiting for funding payment...') },
            {
                delayMs: 5000, action: async () => this.engine.placeOrder(SCENARIO_ACCOUNT, {
                    symbol: 'BTC-PERP', side: 'sell', type: 'limit', size: '0.2',
                    price: await this.getPrice('BTC-PERP'),
                })
            },
            { delayMs: 2000, action: () => console.log('[Scenario] Funding Harvest completed') },
        ];
    }

    private multiSymbolHedge(): ScenarioStep[] {
        return [
            { delayMs: 0, action: () => console.log('[Scenario] Multi-symbol Hedge starting...') },
            {
                delayMs: 1000, action: async () => {
                    await this.engine.placeOrder(SCENARIO_ACCOUNT, {
                        symbol: 'BTC-PERP', side: 'buy', type: 'limit', size: '0.3',
                        price: await this.getPrice('BTC-PERP'),
                    });
                    await this.engine.placeOrder(SCENARIO_ACCOUNT, {
                        symbol: 'ETH-PERP', side: 'sell', type: 'limit', size: '3',
                        price: await this.getPrice('ETH-PERP'),
                    });
                }
            },
            {
                delayMs: 15000, action: async () => {
                    await this.engine.placeOrder(SCENARIO_ACCOUNT, {
                        symbol: 'BTC-PERP', side: 'sell', type: 'limit', size: '0.3',
                        price: await this.getPrice('BTC-PERP'),
                    });
                    await this.engine.placeOrder(SCENARIO_ACCOUNT, {
                        symbol: 'ETH-PERP', side: 'buy', type: 'limit', size: '3',
                        price: await this.getPrice('ETH-PERP'),
                    });
                }
            },
            { delayMs: 2000, action: () => console.log('[Scenario] Multi-symbol Hedge completed') },
        ];
    }
}
