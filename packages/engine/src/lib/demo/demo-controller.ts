/**
 * DemoController — orchestrates PriceOverlay + ScenarioRunner + BotSpawner.
 *
 * Demo mode runs on top of live Binance data — no adapter swapping.
 * Bots trade at real prices, scenarios apply temporary price shocks.
 */

import { PriceOverlay } from './price-overlay';
import { ScenarioRunner, type ScenarioName } from './scenario-runner';
import { BotSpawner } from './bot-spawner';
import type { MatchingEngine } from '../../services/matching/engine';

export class DemoController {
    private engine: MatchingEngine;
    private overlay: PriceOverlay;
    private scenarioRunner: ScenarioRunner;
    private botSpawner: BotSpawner;
    private _active = false;

    constructor(engine: MatchingEngine) {
        this.engine = engine;
        this.overlay = new PriceOverlay();
        this.scenarioRunner = new ScenarioRunner(this.overlay, engine);
        this.botSpawner = new BotSpawner(engine, this.overlay);
    }

    get active(): boolean { return this._active; }

    async start(opts: { numBots?: number; scenario?: ScenarioName } = {}): Promise<void> {
        if (this._active) this.stop();

        console.log('[Demo] Starting demo mode (using live Binance data)...');
        this._active = true;

        if (opts.numBots && opts.numBots > 0) {
            await this.botSpawner.setCount(opts.numBots);
        }

        if (opts.scenario) {
            await this.scenarioRunner.run(opts.scenario);
        }

        console.log('[Demo] Demo mode active ✓');
    }

    stop(): void {
        if (!this._active) return;
        console.log('[Demo] Stopping demo mode...');
        this.scenarioRunner.stop();
        this.botSpawner.stop();
        this.overlay.clearShocks();
        this._active = false;
        console.log('[Demo] Demo mode stopped');
    }

    async setBots(count: number): Promise<void> {
        await this.botSpawner.setCount(count);
    }

    async runScenario(scenario: ScenarioName): Promise<void> {
        if (!this._active) {
            this._active = true;
        }
        await this.scenarioRunner.run(scenario);
    }

    getStatus() {
        return {
            active: this._active,
            bots: this.botSpawner.count,
        };
    }
}
