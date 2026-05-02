'use client';

/**
 * PositionCard — shows positions with health bar and live PnL.
 */

import { memo } from 'react';
import { useTradingStore } from '@/stores/trading';

function PositionCardInner() {
    const positions = useTradingStore((s) => s.positions);
    const mids = useTradingStore((s) => s.mids);

    if (positions.length === 0) {
        return (
            <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-4">
                <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider mb-2">Positions</h3>
                <div className="text-center text-[#8a919e] text-xs py-4">No open positions</div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-4 space-y-2">
            <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider mb-2">Positions</h3>
            {positions.map((pos) => {
                const mid = parseFloat(mids[pos.coin] || '0');
                const entry = parseFloat(pos.entryPrice);
                const size = Math.abs(parseFloat(pos.size));
                const isLong = pos.side === 'long' || parseFloat(pos.size) > 0;
                const pnl = isLong ? (mid - entry) * size : (entry - mid) * size;
                const pnlPct = entry > 0 ? ((pnl / (entry * size)) * 100) : 0;

                // Health bar: 100% = safe, 0% = liquidation
                const liqPrice = parseFloat(pos.liquidationPrice || '0');
                const healthRatio = liqPrice > 0
                    ? Math.max(0, Math.min(1, Math.abs(mid - liqPrice) / Math.abs(entry - liqPrice)))
                    : 1;
                const healthColor = healthRatio > 0.5 ? '#00ff88' : healthRatio > 0.2 ? '#ffaa00' : '#ff3366';

                return (
                    <div key={pos.coin} className="bg-[#141822] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isLong ? 'bg-[#00ff8820] text-[#00ff88]' : 'bg-[#ff336620] text-[#ff3366]'
                                    }`}>
                                    {isLong ? 'LONG' : 'SHORT'}
                                </span>
                                <span className="text-sm text-white font-semibold">{pos.coin}</span>
                            </div>
                            <span className={`text-sm font-mono font-bold ${pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                                <span className="text-[#8a919e]">Size</span>
                                <div className="text-white font-mono">{size.toFixed(4)}</div>
                            </div>
                            <div>
                                <span className="text-[#8a919e]">Entry</span>
                                <div className="text-white font-mono">${entry.toLocaleString()}</div>
                            </div>
                            <div>
                                <span className="text-[#8a919e]">Mark</span>
                                <div className="text-white font-mono">${mid.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Health bar */}
                        <div className="w-full h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${healthRatio * 100}%`, backgroundColor: healthColor }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export const PositionCard = memo(PositionCardInner);
