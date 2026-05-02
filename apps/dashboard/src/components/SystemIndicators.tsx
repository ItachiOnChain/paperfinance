'use client';

/**
 * OnChainAnchor — shows last Merkle root settlement info.
 * LatencyDot — pulsing dot showing WS processing latency.
 */

import { memo, useEffect, useState } from 'react';
import { useTradingStore } from '@/stores/trading';
import { api } from '@/lib/api';
import { OG_CHAIN } from '@/lib/config';

// ── OnChainAnchor ──────────────────────────────────────────
function OnChainAnchorInner() {
    const address = useTradingStore((s) => s.address);
    const [proof, setProof] = useState<any>(null);
    const [ago, setAgo] = useState('—');

    useEffect(() => {
        if (!address) return;
        const load = async () => {
            try {
                const data = await api.proof(address);
                if (data && !data.error) setProof(data);
            } catch { /* ignore */ }
        };
        load();
        const interval = setInterval(load, 30_000);
        return () => clearInterval(interval);
    }, [address]);

    useEffect(() => {
        if (!proof) return;
        const timer = setInterval(() => {
            setAgo('recently');
        }, 1000);
        return () => clearInterval(timer);
    }, [proof]);

    if (!proof) {
        return (
            <div className="flex items-center gap-1.5 text-[10px] text-[#8a919e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8a919e]" />
                <span>No settlement</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[#8a919e]">Epoch {proof.epochId}:</span>
            <span className="text-white font-mono">{proof.merkleRoot?.slice(0, 10)}...</span>
            <a
                href={`${OG_CHAIN.blockExplorers.default.url}/tx/${proof.txHash || ''}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#00ff88] hover:underline"
            >
                ↗
            </a>
        </div>
    );
}

export const OnChainAnchor = memo(OnChainAnchorInner);

// ── LatencyDot ─────────────────────────────────────────────
function LatencyDotInner() {
    const latencyMs = useTradingStore((s) => s.latencyMs);
    const connected = useTradingStore((s) => s.wsConnected);

    const color = !connected
        ? '#8a919e'
        : latencyMs < 10
            ? '#00ff88'
            : latencyMs < 50
                ? '#ffaa00'
                : '#ff3366';

    return (
        <div className="flex items-center gap-1.5 text-[10px]">
            <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: color }}
            />
            <span className="text-[#8a919e] font-mono">
                {connected ? `${latencyMs.toFixed(1)}ms` : 'offline'}
            </span>
        </div>
    );
}

export const LatencyDot = memo(LatencyDotInner);
