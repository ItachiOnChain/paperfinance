'use client';

/**
 * Dashboard — single-page trading layout.
 *
 * Left: chart + order book
 * Right: order form, positions, trade feed
 * Bottom: PnL chart, leaderboard
 */

import dynamic from 'next/dynamic';
import { OrderForm } from '@/components/OrderForm';
import { PositionCard } from '@/components/PositionCard';
import { TradeFeed } from '@/components/TradeFeed';
import { PnLChart } from '@/components/PnLChart';
import { LeaderboardStrip } from '@/components/LeaderboardStrip';
import { OrderBook } from '@/components/OrderBook';

// Dynamic imports for SSR-incompatible components
const CandlestickChart = dynamic(
    () => import('@/components/CandlestickChart').then((m) => ({ default: m.CandlestickChart })),
    { ssr: false, loading: () => <div className="h-[460px] bg-[#0a0e17] rounded-xl animate-pulse" /> },
);

const EngineViz = dynamic(
    () => import('@/components/engine/EngineViz').then((m) => ({ default: m.EngineViz })),
    { ssr: false, loading: () => <div className="h-[200px] bg-[#0a0e17] rounded-xl animate-pulse" /> },
);

// Placeholder order book data
const PLACEHOLDER_BIDS = [
    { price: '96050', size: '1.234' },
    { price: '96000', size: '3.456' },
    { price: '95950', size: '2.123' },
    { price: '95900', size: '5.678' },
    { price: '95850', size: '1.890' },
];
const PLACEHOLDER_ASKS = [
    { price: '96100', size: '2.345' },
    { price: '96150', size: '1.567' },
    { price: '96200', size: '4.321' },
    { price: '96250', size: '2.890' },
    { price: '96300', size: '3.210' },
];

export default function Dashboard() {
    return (
        <div className="flex flex-col gap-2 p-2 h-[calc(100vh-52px)]">
            {/* Main grid */}
            <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
                {/* Left panel: Chart + OrderBook */}
                <div className="col-span-8 flex flex-col gap-2 min-h-0">
                    <div className="flex-1">
                        <CandlestickChart />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <OrderBook bids={PLACEHOLDER_BIDS} asks={PLACEHOLDER_ASKS} />
                        <PnLChart />
                    </div>
                </div>

                {/* Right panel: Order form + Positions + Trade feed */}
                <div className="col-span-4 flex flex-col gap-2 min-h-0 overflow-y-auto">
                    <OrderForm />
                    <PositionCard />
                    <TradeFeed />
                </div>
            </div>

            {/* Engine visualization */}
            <EngineViz />

            {/* Bottom bar: Leaderboard */}
            <LeaderboardStrip />
        </div>
    );
}
