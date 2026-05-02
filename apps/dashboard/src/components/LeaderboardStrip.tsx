'use client';

/**
 * LeaderboardStrip — horizontal scrolling top traders.
 */

import { memo, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LeaderboardEntry {
    rank: number;
    address: string;
    balance: string;
}

function LeaderboardStripInner() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.leaderboard(10);
                if (Array.isArray(data)) setEntries(data);
            } catch { /* ignore */ }
        };
        load();
        const interval = setInterval(load, 30_000);
        return () => clearInterval(interval);
    }, []);

    if (entries.length === 0) {
        return (
            <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-3">
                <span className="text-xs text-[#8a919e]">Leaderboard loading...</span>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-[10px] text-[#8a919e] uppercase tracking-wider whitespace-nowrap font-semibold mr-1">🏆 Top</span>
                {entries.map((e) => (
                    <div
                        key={e.rank}
                        className="flex items-center gap-1.5 bg-[#141822] rounded-lg px-3 py-1.5 whitespace-nowrap shrink-0"
                    >
                        <span className={`text-xs font-bold ${e.rank === 1 ? 'text-yellow-400' : e.rank === 2 ? 'text-gray-300' : e.rank === 3 ? 'text-amber-600' : 'text-[#8a919e]'
                            }`}>
                            #{e.rank}
                        </span>
                        <span className="text-xs text-white font-mono">
                            {e.address.slice(0, 6)}...{e.address.slice(-4)}
                        </span>
                        <span className="text-xs text-[#00ff88] font-mono font-semibold">
                            ${parseFloat(e.balance).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const LeaderboardStrip = memo(LeaderboardStripInner);
