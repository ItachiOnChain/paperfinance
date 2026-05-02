/**
 * BotSpawner — creates N synthetic trading accounts that trade at real Binance prices.
 *
 * All prices come from Redis (populated by BinanceAdapter).
 * Strategies: momentum, meanReversion, random.
 * Each bot places orders every 2–10 seconds.
 */

import { redis, KEYS } from '../../lib/redis';
import { normalizeAddress } from '../../lib/normalizeAddress';
import type { EvmAddress } from '../../lib/normalizeAddress';
import type { MatchingEngine } from '../../services/matching/engine';
import type { PriceOverlay } from './price-overlay';

type Strategy = 'momentum' | 'meanReversion' | 'random';

interface Bot {
    address: EvmAddress;
    strategy: Strategy;
    timer: ReturnType<typeof setInterval>;
    lastPrice: Record<string, number>;
}

const STRATEGIES: Strategy[] = ['momentum', 'meanReversion', 'random'];
const SYMBOLS = ['BTC-PERP', 'ETH-PERP'];

function makeBotAddress(index: number): EvmAddress {
    const hex = index.toString(16).padStart(38, '0');
    return normalizeAddress(`0xB0${hex}` as `0x${string}`);
}

export class BotSpawner {
    private bots: Bot[] = [];
    private engine: MatchingEngine;
    private overlay: PriceOverlay;
    private startingBalance: number;

    constructor(engine: MatchingEngine, overlay: PriceOverlay, startingBalance = 10000) {
        this.engine = engine;
        this.overlay = overlay;
        this.startingBalance = startingBalance;
    }

    async setCount(count: number): Promise<void> {
        count = Math.max(0, Math.min(50, count));

        // Remove excess bots
        while (this.bots.length > count) {
            const bot = this.bots.pop()!;
            clearInterval(bot.timer);
        }

        // Add new bots
        while (this.bots.length < count) {
            const index = this.bots.length;
            const address = makeBotAddress(index);
            const strategy = STRATEGIES[index % STRATEGIES.length];

            // Credit balance
            await redis.set(KEYS.balance(address), this.startingBalance.toString());

            const bot: Bot = {
                address,
                strategy,
                lastPrice: {},
                timer: setInterval(() => this.tick(bot), 2000 + Math.random() * 8000),
            };

            this.bots.push(bot);
        }

        console.log(`[BotSpawner] Active bots: ${this.bots.length}`);
    }

    private async tick(bot: Bot): Promise<void> {
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const price = await this.overlay.getPrice(symbol);
        if (price <= 0) return;

        const lastPrice = bot.lastPrice[symbol] || price;
        bot.lastPrice[symbol] = price;

        let side: 'buy' | 'sell';
        let size: number;

        switch (bot.strategy) {
            case 'momentum':
                side = price > lastPrice ? 'buy' : 'sell';
                size = 0.01 + Math.random() * 0.05;
                break;
            case 'meanReversion':
                side = price < lastPrice ? 'buy' : 'sell';
                size = 0.01 + Math.random() * 0.03;
                break;
            case 'random':
            default:
                side = Math.random() > 0.5 ? 'buy' : 'sell';
                size = 0.005 + Math.random() * 0.02;
                break;
        }

        const offset = side === 'buy' ? -0.1 : 0.1;
        const orderPrice = price * (1 + offset / 100);

        try {
            await this.engine.placeOrder(bot.address, {
                symbol,
                side,
                type: 'limit',
                size: size.toFixed(5),
                price: orderPrice.toFixed(2),
            });
        } catch { /* bots can fail silently */ }
    }

    stop(): void {
        for (const bot of this.bots) {
            clearInterval(bot.timer);
        }
        this.bots = [];
        console.log('[BotSpawner] All bots stopped');
    }

    get count(): number {
        return this.bots.length;
    }
}
