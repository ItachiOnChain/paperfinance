'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

async function demoFetch(path: string, body?: Record<string, unknown>) {
    const res = await fetch(`${API_URL}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify({ ...body, secret: 'demo-secret-dev' }) : undefined,
    });
    return res.json();
}

// Icons
const ActivityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
);

const TargetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
    </svg>
);

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const StopIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
);

export default function Dashboard() {
    // Real tracking state
    const [botAddress, setBotAddress] = useState('');
    const [inputAddress, setInputAddress] = useState('');

    // Presentation / Hallucinated state
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [demoFills, setDemoFills] = useState<any[]>([]);
    const [demoPositions, setDemoPositions] = useState<any[]>([]);
    const demoInterval = useRef<NodeJS.Timeout | null>(null);

    // Live Queries (only active if an address is pasted and demo is OFF)
    const { data: remoteFillsData, isLoading: isLoadingFills } = useQuery({
        queryKey: ['userFills', botAddress],
        queryFn: () => api.userFills(botAddress).catch(() => []),
        refetchInterval: 2000,
        enabled: !!botAddress && !isDemoMode,
    });

    const { data: remoteStateData } = useQuery({
        queryKey: ['clearinghouseState', botAddress],
        queryFn: () => api.clearinghouseState(botAddress).catch(() => null),
        refetchInterval: 2000,
        enabled: !!botAddress && !isDemoMode,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (isDemoMode) stopDemo();
        setBotAddress(inputAddress);
    };

    const stopDemo = async () => {
        setIsDemoMode(false);
        if (demoInterval.current) clearInterval(demoInterval.current);
        setDemoFills([]);
        setDemoPositions([]);
        setInputAddress('');
        setBotAddress('');
        try { await demoFetch('/demo/stop', {}); } catch (e) { }
    };

    const startDemo = async () => {
        setIsDemoMode(true);
        setBotAddress('');
        setInputAddress('0xAI...DEEP_LEARNING_SYNC');

        try { await demoFetch('/demo/start', { numBots: 1 }); } catch (e) { }

        // Seed 15 highly profitable historical mock trades
        const initialFills = Array.from({ length: 15 }).map((_, i) => createMockDemoFill(Date.now() - (15 - i) * 8000));
        setDemoFills(initialFills);

        setDemoPositions([
            { coin: 'BTC-PERP', size: '2.5000', entryPrice: '95120.40' },
            { coin: 'ETH-PERP', size: '-14.0000', entryPrice: '3305.10' }
        ]);

        if (demoInterval.current) clearInterval(demoInterval.current);
        demoInterval.current = setInterval(() => {
            setDemoFills(prev => {
                const newFill = createMockDemoFill(Date.now());

                // Realistically fluctuate positions
                setDemoPositions(currPos => {
                    let next = [...currPos];
                    if (Math.random() > 0.4) {
                        const target = newFill.coin;
                        const existIdx = next.findIndex(p => p.coin === target);

                        if (existIdx >= 0) {
                            let sz = parseFloat(next[existIdx].size);
                            sz += newFill.dir === 'Buy' ? parseFloat(newFill.sz) : -parseFloat(newFill.sz);
                            next[existIdx].size = sz.toFixed(4);
                        } else {
                            next.push({ coin: target, size: newFill.dir === 'Buy' ? newFill.sz : `-${newFill.sz}`, entryPrice: newFill.px });
                        }
                    }
                    return next.filter(p => Math.abs(parseFloat(p.size)) > 0.05).slice(0, 4);
                });

                const updated = [newFill, ...prev].slice(0, 100);
                return updated;
            });
        }, 1500); // Super dynamic! Updates every 1.5 seconds.
    };

    useEffect(() => {
        return () => {
            if (demoInterval.current) clearInterval(demoInterval.current);
            demoFetch('/demo/stop', {}).catch(() => { });
        };
    }, []);

    function createMockDemoFill(time: number) {
        // Organic 48-52% win rate to ensure the chart oscillates with real drawdowns and recoveries
        const isWin = Math.random() > 0.48;
        const token = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'][Math.floor(Math.random() * 3)];
        const dir = Math.random() > 0.5 ? 'Buy' : 'Sell';
        const px = token === 'BTC-PERP' ? 95000 + (Math.random() * 200 - 100) : token === 'ETH-PERP' ? 3300 + (Math.random() * 10 - 5) : 150 + Math.random() * 2;
        const sz = (Math.random() * 0.8 + 0.1).toFixed(3);
        const pnl = isWin ? (Math.random() * 45 + 10) : -(Math.random() * 55 + 15);
        return { timestamp: time, coin: token, dir, sz, px: px.toFixed(2), mockPnL: pnl, fee: (Math.random() * 0.1).toFixed(4) };
    }

    const fills = isDemoMode ? demoFills : (Array.isArray(remoteFillsData) ? remoteFillsData : (remoteFillsData?.fills || []));
    const positions = isDemoMode ? demoPositions : ((remoteStateData?.assetPositions || remoteStateData?.positions) || []);

    // Derived Metrics
    const totalTrades = fills.length;
    let successfulTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalPnL = 0;
    let peakEquity = 0;
    let currentEquity = 10000;

    const chartData: any[] = [];
    const sortedFills = [...fills].sort((a, b) => Number(a.timestamp || a.time) - Number(b.timestamp || b.time));

    sortedFills.forEach((fill: any) => {
        let mockPnL = 0;
        if (isDemoMode) {
            mockPnL = fill.mockPnL;
        } else {
            mockPnL = parseFloat(fill.closedPnl || fill.realizedPnl || '0');
            if (isNaN(mockPnL)) mockPnL = 0;
            let fee = parseFloat(fill.fee || '0');
            if (isNaN(fee)) fee = 0;
            if (mockPnL === 0 && fee > 0) mockPnL = -fee;
        }

        totalPnL += mockPnL;
        currentEquity += mockPnL;

        if (mockPnL > 0) {
            successfulTrades++;
            grossProfit += mockPnL;
        } else if (mockPnL < 0) {
            grossLoss += Math.abs(mockPnL);
        }

        if (currentEquity > peakEquity) peakEquity = currentEquity;
        const stamp = Number(fill.timestamp || fill.time);
        const dateObj = new Date(stamp);
        const timeStr = (!stamp || isNaN(dateObj.getTime())) ? '00:00:00' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        chartData.push({
            name: timeStr,
            pnl: totalPnL,
            equity: currentEquity
        });
    });

    if (chartData.length === 0) {
        chartData.push({ name: 'Start', pnl: 0, equity: 10000 });
    }

    const openPositionsData = positions.filter((p: any) => {
        const sz = parseFloat(p.netSize || p.size || '0');
        return !isNaN(sz) && sz !== 0;
    });

    const openTrades = openPositionsData.length;
    const successRate = totalTrades > 0 ? ((successfulTrades / totalTrades) * 100).toFixed(1) : '0.0';
    const avgWin = successfulTrades > 0 ? (grossProfit / successfulTrades).toFixed(4) : '0.0000';
    const unsuccessfulTrades = totalTrades - successfulTrades;
    const avgLoss = unsuccessfulTrades > 0 ? (grossLoss / unsuccessfulTrades).toFixed(4) : '0.0000';

    return (
        <div className="flex flex-col gap-6 p-6 h-[calc(100vh-52px)] overflow-y-auto bg-[#0a0e17] text-white">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#121826]/80 p-5 rounded-2xl border border-[#1e293b] shadow-md backdrop-blur-md">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                        Trader Dashboard
                        {isDemoMode && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.2)]">AI Presentation Live</span>}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{isDemoMode ? 'Streaming predictive pattern executions' : 'Awaiting manual query'}</p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 md:w-auto">
                        <input
                            type="text"
                            disabled={isDemoMode}
                            value={inputAddress}
                            onChange={(e) => setInputAddress(e.target.value)}
                            placeholder="0x... or wait for Demo"
                            className={`px-4 py-2 bg-[#060911]/50 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-72 transition-all font-mono ${isDemoMode ? 'border-emerald-500/30 text-emerald-400/80' : 'border-[#1e293b] text-white'}`}
                        />
                        <button type="submit" disabled={isDemoMode} className="px-4 py-2 bg-[#1e293b] hover:bg-[#2a374a] text-white rounded-xl text-sm transition-colors font-medium disabled:opacity-50">
                            Query
                        </button>
                    </form>
                    <button
                        onClick={isDemoMode ? stopDemo : startDemo}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${isDemoMode
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 hover:scale-105'
                            }`}
                    >
                        {isDemoMode ? <StopIcon /> : <PlayIcon />}
                        {isDemoMode ? 'Stop Demo Bot' : 'Start Presentation Demo'}
                    </button>
                </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-1 border-t-[3px] border-t-blue-500 col-span-2 lg:col-span-1 shadow-lg relative overflow-hidden">
                    {isDemoMode && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent animate-pulse" />}
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Executions</span>
                    <span className="text-3xl font-bold text-white tabular-nums drop-shadow-md">{totalTrades}</span>
                    <span className="text-xs text-slate-500 mt-1">Confirmed blocks</span>
                </div>

                <div className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-1 border-t-[3px] border-t-emerald-500 shadow-lg">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Open Positions</span>
                    <span className="text-3xl font-bold text-white tabular-nums">{openTrades}</span>
                    <span className="text-xs text-slate-500 mt-1">Assets currently held</span>
                </div>

                <div className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-1 border-t-[3px] border-t-purple-500 shadow-lg relative">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Net Profit</span>
                    <span className={`text-3xl font-bold tabular-nums drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">Cumulative absolute</span>
                </div>

                <div className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-1 border-t-[3px] border-t-pink-500 shadow-lg relative">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Win Rate</span>
                    <span className="text-3xl font-bold text-white tabular-nums">{successRate}%</span>
                    <span className="text-xs text-slate-500 mt-1">Profitable probability</span>
                </div>

                <div className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-5 flex flex-col gap-1 border-t-[3px] border-t-amber-500 shadow-lg">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Efficiency Profile</span>
                    <span className="text-xl font-bold text-emerald-400 tabular-nums drop-shadow-sm">+{avgWin}</span>
                    <span className="text-xl font-bold text-red-500/80 tabular-nums">-{avgLoss}</span>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="col-span-2 bg-[#121826]/50 border border-[#1e293b] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                        Equity Curve Vector
                    </h3>
                    <div className="h-[280px] w-full min-w-0 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={totalPnL >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={totalPnL >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} minTickGap={30} />
                                <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} width={80} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="equity" stroke={totalPnL >= 0 ? '#34d399' : '#f87171'} strokeWidth={3} fillOpacity={1} fill="url(#colorPnL)" isAnimationActive={true} animationDuration={500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="col-span-1 bg-[#121826]/50 border border-[#1e293b] rounded-2xl flex flex-col overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-[#1e293b] bg-[#1a2333]/50 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Current Holdings</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar min-h-[300px]">
                        {openPositionsData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}>
                                    <TargetIcon />
                                </motion.div>
                                <p className="text-sm mt-4 font-medium text-slate-400">All Operations Arbitraged.</p>
                                <span className="px-3 py-1.5 mt-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold rounded-lg shadow-sm tracking-widest">Zero Exposure</span>
                            </div>
                        ) : (
                            openPositionsData.map((pos: any, i: number) => {
                                const size = parseFloat(pos.netSize || pos.size || '0');
                                const isLong = size > 0;
                                const entry = parseFloat(pos.entryPrice || pos.entryPx || '0');

                                return (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className="flex justify-between items-center bg-[#060911]/80 p-4 rounded-xl border border-[#1e293b] hover:border-slate-700 transition-colors">
                                        <div>
                                            <p className="font-bold text-white text-lg tracking-wide">{pos.coin}</p>
                                            <p className="text-xs text-slate-400 mt-1">Entry: <span className="text-slate-300 font-mono">${!isNaN(entry) ? entry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span></p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${isLong ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'} border`}>
                                                {isLong ? 'LONG' : 'SHORT'}
                                            </span>
                                            <p className="text-sm font-mono text-slate-200 mt-2 font-bold">{Math.abs(size).toFixed(4)}</p>
                                        </div>
                                    </motion.div>
                                )
                            })
                        )}
                    </div>
                </motion.div>

            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#121826]/50 border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl mt-6">
                <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#1a2333]/50">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Neural Executions Journal</h3>
                    <AnimatePresence>
                        {totalTrades > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs text-slate-400 font-mono">Synced</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="overflow-x-auto custom-scrollbar min-h-[250px] max-h-[400px] relative">
                    {isLoadingFills && (!fills || fills.length === 0) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#121826]/50 z-10 backdrop-blur-[1px]">
                            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                        </div>
                    )}
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-[#0d131f] border-b border-[#1e293b] sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-bold tracking-wider">Timestamp</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Asset</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Action</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Fill Price</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Size</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Realized / Fee</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]/50">
                            {fills.length === 0 && !isLoadingFills && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                                        <div className="flex flex-col items-center gap-3">
                                            <ActivityIcon />
                                            Start Presentation Demo to visualize high-frequency neural arbitrage.
                                        </div>
                                    </td>
                                </tr>
                            )}
                            <AnimatePresence>
                                {sortedFills.reverse().slice(0, 50).map((fill: any, i: number) => {
                                    const stamp = Number(fill.timestamp || fill.time);
                                    const dateObj = new Date(stamp);
                                    const timeStr = (!stamp || isNaN(dateObj.getTime())) ? '-' : dateObj.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

                                    let rPnl = 0;
                                    if (isDemoMode) {
                                        rPnl = fill.mockPnL;
                                    } else {
                                        rPnl = parseFloat(fill.closedPnl || fill.realizedPnl || '0');
                                        if (isNaN(rPnl)) rPnl = 0;
                                    }

                                    return (
                                        <motion.tr
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            key={i + '-' + stamp}
                                            className="hover:bg-[#1a2333]/80 transition-colors group"
                                        >
                                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap font-mono tabular-nums">
                                                {timeStr}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-200">
                                                {fill.coin || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${fill.dir === 'Buy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} transition-colors`}>
                                                    {fill.dir}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-300 tabular-nums">
                                                ${parseFloat(fill.px).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-400 tabular-nums">
                                                {fill.sz}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold tabular-nums drop-shadow-sm ${rPnl > 0 ? 'text-emerald-400' : (rPnl < 0 ? 'text-red-400' : 'text-slate-500')}`}>
                                                {rPnl !== 0 ? (rPnl > 0 ? `+${rPnl.toFixed(4)}` : rPnl.toFixed(4)) : (fill.fee ? `Fee: -${parseFloat(fill.fee).toFixed(4)}` : '-')}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
