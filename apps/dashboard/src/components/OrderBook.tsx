'use client';

/**
 * OrderBook — depth visualization with colored bars.
 */

import { memo, useMemo } from 'react';

interface Level { price: string; size: string }

function OrderBookInner({ bids, asks }: { bids: Level[]; asks: Level[] }) {
    const maxDepth = useMemo(() => {
        const allSizes = [...bids, ...asks].map((l) => parseFloat(l.size));
        return Math.max(...allSizes, 1);
    }, [bids, asks]);

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-3">
            <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider mb-2">Order Book</h3>
            <div className="flex text-[10px] text-[#8a919e] mb-1 px-1">
                <span className="flex-1">Price</span>
                <span className="flex-1 text-right">Size</span>
            </div>

            {/* Asks (reversed - lowest first) */}
            <div className="space-y-px mb-1">
                {asks.slice(0, 8).reverse().map((l, i) => {
                    const ratio = parseFloat(l.size) / maxDepth;
                    return (
                        <div key={`a-${i}`} className="relative flex text-xs font-mono px-1 py-0.5">
                            <div className="absolute inset-0 bg-[#ff336615] rounded-sm" style={{ width: `${ratio * 100}%`, right: 0, left: 'auto' }} />
                            <span className="flex-1 text-[#ff3366] relative z-10">{parseFloat(l.price).toLocaleString()}</span>
                            <span className="flex-1 text-right text-[#8a919e] relative z-10">{parseFloat(l.size).toFixed(4)}</span>
                        </div>
                    );
                })}
            </div>

            {/* Spread */}
            <div className="text-center text-[10px] text-[#8a919e] py-0.5 border-y border-[#1a1f2e]">
                {bids[0] && asks[0] ? `Spread: ${(parseFloat(asks[0].price) - parseFloat(bids[0].price)).toFixed(2)}` : '—'}
            </div>

            {/* Bids */}
            <div className="space-y-px mt-1">
                {bids.slice(0, 8).map((l, i) => {
                    const ratio = parseFloat(l.size) / maxDepth;
                    return (
                        <div key={`b-${i}`} className="relative flex text-xs font-mono px-1 py-0.5">
                            <div className="absolute inset-0 bg-[#00ff8815] rounded-sm" style={{ width: `${ratio * 100}%`, right: 0, left: 'auto' }} />
                            <span className="flex-1 text-[#00ff88] relative z-10">{parseFloat(l.price).toLocaleString()}</span>
                            <span className="flex-1 text-right text-[#8a919e] relative z-10">{parseFloat(l.size).toFixed(4)}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const OrderBook = memo(OrderBookInner);
