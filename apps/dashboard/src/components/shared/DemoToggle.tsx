'use client';

/**
 * DemoToggle — header control for demo mode.
 * Toggle live/demo, select scenarios, adjust bot count.
 */

import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '@/lib/config';

const DEMO_SECRET = 'demo-secret-dev'; // matches .env DEMO_MODE_SECRET

async function demoFetch(path: string, body?: Record<string, unknown>) {
    const res = await fetch(`${API_URL}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify({ ...body, secret: DEMO_SECRET }) : undefined,
    });
    return res.json();
}

const SCENARIOS = [
    { id: 'btcCrash', label: 'BTC Flash Crash', icon: '📉' },
    { id: 'altcoinMoon', label: 'ETH Moon', icon: '🚀' },
    { id: 'fundingHarvest', label: 'Funding Harvest', icon: '💰' },
    { id: 'multiSymbolHedge', label: 'Multi Hedge', icon: '🔄' },
] as const;

export function DemoToggle() {
    const [active, setActive] = useState(false);
    const [botCount, setBotCount] = useState(5);
    const [expanded, setExpanded] = useState(false);

    // Poll status
    useEffect(() => {
        const poll = async () => {
            try {
                const status = await demoFetch('/demo/status');
                setActive(status.active);
            } catch { /* server not running */ }
        };
        poll();
        const interval = setInterval(poll, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleDemo = useCallback(async () => {
        if (active) {
            await demoFetch('/demo/stop', {});
            setActive(false);
        } else {
            await demoFetch('/demo/start', { numBots: botCount });
            setActive(true);
        }
    }, [active, botCount]);

    const handleBotChange = useCallback(async (count: number) => {
        setBotCount(count);
        if (active) {
            await demoFetch('/demo/setBots', { count });
        }
    }, [active]);

    const runScenario = useCallback(async (scenario: string) => {
        if (!active) {
            await demoFetch('/demo/start', { numBots: botCount, scenario });
            setActive(true);
        } else {
            await demoFetch('/demo/scenario', { scenario });
        }
    }, [active, botCount]);

    return (
        <div className="relative">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all ${active
                        ? 'border-[#00ff88] bg-[#00ff8815] text-[#00ff88]'
                        : 'border-[#1a1f2e] bg-[#0d1117] text-[#8a919e] hover:border-[#2a2f3e]'
                    }`}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#00ff88] animate-pulse' : 'bg-[#8a919e]'}`} />
                {active ? 'DEMO' : 'LIVE'}
                <svg className={`w-2.5 h-2.5 transition ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-[#0d1117] border border-[#1a1f2e] rounded-xl p-3 z-50 shadow-xl">
                    {/* Toggle */}
                    <button
                        onClick={toggleDemo}
                        className={`w-full text-xs font-semibold py-1.5 rounded-lg mb-2 transition ${active
                                ? 'bg-[#ff336620] text-[#ff3366] border border-[#ff3366]'
                                : 'bg-[#00ff8820] text-[#00ff88] border border-[#00ff88]'
                            }`}
                    >
                        {active ? '■ Stop Demo' : '▶ Start Demo'}
                    </button>

                    {/* Bot slider */}
                    <div className="mb-2">
                        <div className="flex justify-between text-[9px] text-[#8a919e] mb-0.5">
                            <span>Bots</span>
                            <span className="font-mono">{botCount}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={50}
                            value={botCount}
                            onChange={(e) => handleBotChange(Number(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    {/* Scenarios */}
                    <div className="text-[9px] text-[#8a919e] mb-1">Scenarios</div>
                    <div className="grid grid-cols-2 gap-1">
                        {SCENARIOS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => runScenario(s.id)}
                                className="text-[9px] px-2 py-1.5 rounded-lg bg-[#141822] border border-[#1a1f2e] text-white hover:border-[#00ff88] transition text-left"
                            >
                                {s.icon} {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
