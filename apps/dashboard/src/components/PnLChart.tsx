'use client';

/**
 * PnLChart — equity curve using recharts AreaChart.
 * Green fill if equity > start, red if below.
 */

import { memo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useTradingStore } from '@/stores/trading';

function PnLChartInner() {
    const balance = useTradingStore((s) => s.balance);
    const bal = parseFloat(balance);

    // Generate sample equity curve data (in prod: fetch from API)
    const data = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        equity: Math.max(0, bal + (Math.random() - 0.48) * bal * 0.05 * i),
    }));

    const startBalance = data[0]?.equity || 0;
    const isProfit = bal >= startBalance;

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-3">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider">Equity Curve</h3>
                <span className={`text-sm font-mono font-bold ${isProfit ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                    ${bal.toLocaleString()}
                </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isProfit ? '#00ff88' : '#ff3366'} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isProfit ? '#00ff88' : '#ff3366'} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                        contentStyle={{ background: '#141822', border: '1px solid #1a1f2e', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#8a919e' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="equity"
                        stroke={isProfit ? '#00ff88' : '#ff3366'}
                        fill="url(#equityGrad)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export const PnLChart = memo(PnLChartInner);
