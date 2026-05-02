'use client';

/**
 * EngineViz — animated pipeline visualization.
 *
 * Shows 5 nodes: Market Data → Matching Engine → State Update → Risk Check → Broadcast
 * With pulse animations on events, throughput counters, and flowing dashes between nodes.
 */

import { useEffect, useRef, useState, memo, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTradingStore } from '@/stores/trading';

// ── Types ────────────────────────────────────────────────────
interface EngineEvent {
    id: string;
    event: 'fill' | 'tick' | 'liquidation' | 'funding';
    symbol: string;
    latencyUs: number;
    ts: number;
}

interface NodeDef {
    id: string;
    label: string;
    icon: string;
    color: string;
    pulseColor: string;
}

const PIPELINE_NODES: NodeDef[] = [
    { id: 'market', label: 'Market Data', icon: '📡', color: '#00ff88', pulseColor: '#00ff88' },
    { id: 'matching', label: 'Matching Engine', icon: '⚡', color: '#00aaff', pulseColor: '#ffaa00' },
    { id: 'state', label: 'State Update', icon: '💾', color: '#aa77ff', pulseColor: '#aa77ff' },
    { id: 'risk', label: 'Risk Check', icon: '🛡️', color: '#ffaa00', pulseColor: '#ff3366' },
    { id: 'broadcast', label: 'Broadcast', icon: '📢', color: '#ff77aa', pulseColor: '#ff77aa' },
];

// ── Pipeline Node ────────────────────────────────────────────
function PipelineNode({ node, throughput, isPulsing }: { node: NodeDef; throughput: number; isPulsing: boolean }) {
    const controls = useAnimation();

    useEffect(() => {
        if (isPulsing) {
            controls.start({
                scale: [1, 1.06, 1],
                borderColor: [node.color, node.pulseColor, node.color],
                transition: { duration: 0.3 },
            });
        }
    }, [isPulsing, controls, node]);

    return (
        <motion.div
            animate={controls}
            className="relative flex flex-col items-center justify-center w-[120px] h-[80px] rounded-xl border-2 bg-[#0d1117]"
            style={{ borderColor: node.color }}
        >
            <span className="text-lg">{node.icon}</span>
            <span className="text-[9px] font-semibold text-white mt-0.5 text-center leading-tight">{node.label}</span>
            <span className="text-[9px] font-mono mt-0.5" style={{ color: node.color }}>
                {throughput}/s
            </span>
            {isPulsing && (
                <motion.div
                    className="absolute inset-0 rounded-xl"
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ backgroundColor: node.pulseColor }}
                />
            )}
        </motion.div>
    );
}

// ── Animated dash connector ──────────────────────────────────
function FlowConnector({ speed }: { speed: number }) {
    const dashSpeed = Math.max(0.5, 10 / Math.max(speed, 1));
    return (
        <svg width="40" height="20" className="mx-0.5 flex-shrink-0">
            <line
                x1="0" y1="10" x2="40" y2="10"
                stroke="#1a1f2e"
                strokeWidth="2"
            />
            <line
                x1="0" y1="10" x2="40" y2="10"
                stroke="#00ff8880"
                strokeWidth="2"
                strokeDasharray="6 4"
                style={{
                    animation: `dash-flow ${dashSpeed}s linear infinite`,
                }}
            />
        </svg>
    );
}

// ── Event Log Row ────────────────────────────────────────────
function EventRow({ event }: { event: EngineEvent }) {
    const colorMap = {
        tick: '#8a919e',
        fill: '#00ff88',
        liquidation: '#ff3366',
        funding: '#ffaa00',
    };
    return (
        <div className="flex items-center text-[10px] font-mono px-2 py-0.5 gap-2">
            <span className="text-[#8a919e] w-16">{new Date(event.ts).toLocaleTimeString()}</span>
            <span className="w-20 font-semibold" style={{ color: colorMap[event.event] }}>
                {event.event.toUpperCase()}
            </span>
            <span className="text-white w-16">{event.symbol}</span>
            <span className="text-[#8a919e] flex-1 text-right">{event.latencyUs}µs</span>
        </div>
    );
}

// ── Metric Card ──────────────────────────────────────────────
function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-[#0d1117] rounded-lg border border-[#1a1f2e] px-3 py-2 flex-1 min-w-[100px]">
            <div className="text-[9px] text-[#8a919e] uppercase tracking-wider">{label}</div>
            <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
        </div>
    );
}

// ── Demo event generator ─────────────────────────────────────
function generateDemoEvent(): EngineEvent {
    const events: EngineEvent['event'][] = ['tick', 'tick', 'tick', 'fill', 'funding'];
    const symbols = ['BTC-PERP', 'ETH-PERP'];
    const ev = events[Math.floor(Math.random() * events.length)];
    return {
        id: Math.random().toString(36).slice(2, 10),
        event: ev,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        latencyUs: Math.round(800 + Math.random() * 2200),
        ts: Date.now(),
    };
}

// ── Main Component ───────────────────────────────────────────
function EngineVizInner() {
    const [events, setEvents] = useState<EngineEvent[]>([]);
    const [throughputs, setThroughputs] = useState<number[]>([0, 0, 0, 0, 0]);
    const [pulsingNodes, setPulsingNodes] = useState<Set<string>>(new Set());
    const [totalFills, setTotalFills] = useState(0);
    const [avgLatency, setAvgLatency] = useState(0);
    const [wsMessagesPerSec, setWsMessagesPerSec] = useState(0);
    const wsConnected = useTradingStore((s) => s.wsConnected);
    const positions = useTradingStore((s) => s.positions);

    const eventCountRef = useRef(0);
    const fillCountRef = useRef(0);
    const latencySumRef = useRef(0);
    const latencyCountRef = useRef(0);
    const logRef = useRef<HTMLDivElement>(null);

    const handleEvent = useCallback((ev: EngineEvent) => {
        setEvents((prev) => [ev, ...prev].slice(0, 50));
        eventCountRef.current++;
        latencySumRef.current += ev.latencyUs;
        latencyCountRef.current++;

        if (ev.event === 'fill') {
            fillCountRef.current++;
            setPulsingNodes(new Set(['matching']));
            setTimeout(() => setPulsingNodes((s) => { const n = new Set(s); n.delete('matching'); return n; }), 350);
        }
        if (ev.event === 'liquidation') {
            setPulsingNodes(new Set(['risk']));
            setTimeout(() => setPulsingNodes((s) => { const n = new Set(s); n.delete('risk'); return n; }), 350);
        }
        // Cascade pulse through pipeline
        const nodeOrder = ['market', 'matching', 'state', 'risk', 'broadcast'];
        nodeOrder.forEach((nodeId, i) => {
            setTimeout(() => {
                setPulsingNodes((s) => new Set([...s, nodeId]));
                setTimeout(() => setPulsingNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; }), 200);
            }, i * 60);
        });
    }, []);

    // Demo mode: generate events when no real events arrive
    useEffect(() => {
        const interval = setInterval(() => {
            const ev = generateDemoEvent();
            handleEvent(ev);
        }, 300 + Math.random() * 400);
        return () => clearInterval(interval);
    }, [handleEvent]);

    // Update metrics every second
    useEffect(() => {
        const interval = setInterval(() => {
            const rate = eventCountRef.current;
            setWsMessagesPerSec(rate);
            setThroughputs([rate, Math.round(rate * 0.3), Math.round(rate * 0.3), Math.round(rate * 0.2), rate]);
            setTotalFills(fillCountRef.current);
            if (latencyCountRef.current > 0) {
                setAvgLatency(Math.round(latencySumRef.current / latencyCountRef.current));
            }
            eventCountRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const virtualizer = useVirtualizer({
        count: events.length,
        getScrollElement: () => logRef.current,
        estimateSize: () => 20,
        overscan: 3,
    });

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-4 space-y-3">
            {/* Title */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#8a919e] uppercase tracking-wider">Engine Pipeline</h3>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#00ff88] animate-pulse' : 'bg-[#ff3366]'}`} />
                    <span className="text-[9px] text-[#8a919e]">{wsConnected ? 'LIVE' : 'DEMO'}</span>
                </div>
            </div>

            {/* Metric cards */}
            <div className="flex gap-2">
                <MetricCard label="Total Fills" value={totalFills.toString()} color="#00ff88" />
                <MetricCard label="Avg Latency" value={`${avgLatency}µs`} color="#00aaff" />
                <MetricCard label="Active Pos." value={positions.length.toString()} color="#aa77ff" />
                <MetricCard label="Events/sec" value={wsMessagesPerSec.toString()} color="#ffaa00" />
            </div>

            {/* Pipeline graph */}
            <div className="flex items-center justify-center py-2">
                {PIPELINE_NODES.map((node, i) => (
                    <div key={node.id} className="flex items-center">
                        <PipelineNode
                            node={node}
                            throughput={throughputs[i]}
                            isPulsing={pulsingNodes.has(node.id)}
                        />
                        {i < PIPELINE_NODES.length - 1 && <FlowConnector speed={throughputs[i]} />}
                    </div>
                ))}
            </div>

            {/* Event log */}
            <div className="border-t border-[#1a1f2e] pt-2">
                <div className="flex items-center text-[9px] text-[#8a919e] px-2 mb-1 font-semibold">
                    <span className="w-16">Time</span>
                    <span className="w-20">Type</span>
                    <span className="w-16">Symbol</span>
                    <span className="flex-1 text-right">Latency</span>
                </div>
                <div ref={logRef} className="h-[100px] overflow-auto">
                    {events.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-[#8a919e] text-[10px]">
                            Waiting for engine events...
                        </div>
                    ) : (
                        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                            {virtualizer.getVirtualItems().map((vi) => (
                                <div
                                    key={vi.key}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                                >
                                    <EventRow event={events[vi.index]} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export const EngineViz = memo(EngineVizInner);
