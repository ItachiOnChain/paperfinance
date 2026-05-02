'use client';

/**
 * TradeFeed — virtualized list of recent fills with flash animation.
 */

import { memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTradingStore } from '@/stores/trading';
import type { Fill } from '@/stores/trading';

function FillRow({ fill }: { fill: Fill }) {
    const isBuy = fill.side === 'buy';
    return (
        <div className={`flex items-center text-xs font-mono px-3 py-1.5 animate-flash-row ${isBuy ? 'flash-green' : 'flash-red'
            }`}>
            <span className={`w-10 font-semibold ${isBuy ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                {isBuy ? 'BUY' : 'SELL'}
            </span>
            <span className="flex-1 text-white">{fill.symbol}</span>
            <span className="w-20 text-right text-[#8a919e]">{parseFloat(fill.size).toFixed(4)}</span>
            <span className="w-24 text-right text-white">${parseFloat(fill.price).toLocaleString()}</span>
            <span className={`w-20 text-right ${parseFloat(fill.realizedPnl) >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                {parseFloat(fill.realizedPnl) >= 0 ? '+' : ''}{parseFloat(fill.realizedPnl).toFixed(2)}
            </span>
            <span className="w-16 text-right text-[#8a919e] text-[10px]">
                {new Date(fill.timestamp).toLocaleTimeString()}
            </span>
        </div>
    );
}

function TradeFeedInner() {
    const fills = useTradingStore((s) => s.fills);
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: fills.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 5,
    });

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e]">
            <div className="px-3 py-2 border-b border-[#1a1f2e]">
                <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider">Trade Feed</h3>
            </div>

            {/* Header */}
            <div className="flex text-[10px] text-[#8a919e] px-3 py-1 border-b border-[#1a1f2e]">
                <span className="w-10">Side</span>
                <span className="flex-1">Symbol</span>
                <span className="w-20 text-right">Size</span>
                <span className="w-24 text-right">Price</span>
                <span className="w-20 text-right">PnL</span>
                <span className="w-16 text-right">Time</span>
            </div>

            <div ref={parentRef} className="h-[200px] overflow-auto">
                {fills.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-[#8a919e] text-xs">No trades yet</div>
                ) : (
                    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                        {virtualizer.getVirtualItems().map((vi) => (
                            <div
                                key={vi.key}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                            >
                                <FillRow fill={fills[vi.index]} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export const TradeFeed = memo(TradeFeedInner);
