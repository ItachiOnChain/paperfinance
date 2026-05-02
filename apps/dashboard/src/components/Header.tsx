'use client';

/**
 * Header — logo, wallet connect (RainbowKit), balance, system indicators.
 * Handles SIWE auth flow after wallet connection.
 */

import { useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { useTradingStore } from '@/stores/trading';
import { LatencyDot, OnChainAnchor } from './SystemIndicators';
import { DemoToggle } from './shared/DemoToggle';
import { api } from '@/lib/api';
import { connectWs } from '@/lib/ws';
import { API_URL } from '@/lib/config';

export function Header() {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { jwt, setAuth, balance } = useTradingStore();

    // SIWE auth flow on wallet connect
    const doSiweAuth = useCallback(async (addr: string) => {
        try {
            // 1. Get nonce
            const nonceRes = await api.getNonce(addr);
            if (!nonceRes.nonce) return;

            // 2. Build SIWE message
            const domain = new URL(API_URL).hostname || 'localhost';
            const uri = API_URL;
            const message = [
                `${domain} wants you to sign in with your Ethereum account:`,
                addr,
                '',
                'Sign in to HyPaper Trading',
                '',
                `URI: ${uri}`,
                `Version: 1`,
                `Chain ID: 16602`,
                `Nonce: ${nonceRes.nonce}`,
                `Issued At: ${new Date().toISOString()}`,
            ].join('\n');

            // 3. Sign
            const signature = await signMessageAsync({ message });

            // 4. Verify + get JWT
            const verifyRes = await api.verify(message, signature);
            if (verifyRes.token) {
                setAuth(verifyRes.token, addr);
                connectWs();
            }
        } catch (err) {
            console.error('[SIWE] Auth failed:', err);
        }
    }, [signMessageAsync, setAuth]);

    useEffect(() => {
        if (isConnected && address && !jwt) {
            doSiweAuth(address);
        }
    }, [isConnected, address, jwt, doSiweAuth]);

    // Fetch account data after auth
    useEffect(() => {
        if (!jwt || !address) return;
        const load = async () => {
            try {
                const state = await api.clearinghouseState(address);
                if (state?.marginSummary?.accountValue) {
                    useTradingStore.getState().setBalance(state.marginSummary.accountValue);
                }
                if (state?.assetPositions) {
                    useTradingStore.getState().setPositions(state.assetPositions);
                }
                const fills = await api.userFills(address);
                if (Array.isArray(fills)) useTradingStore.getState().setFills(fills);
                const orders = await api.openOrders(address);
                if (Array.isArray(orders)) useTradingStore.getState().setOrders(orders);
            } catch { /* ignore */ }
        };
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [jwt, address]);

    return (
        <header className="flex items-center justify-between px-4 py-2 bg-[#0a0e17] border-b border-[#1a1f2e]">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#00aa55] flex items-center justify-center text-black font-black text-xs">
                        0G
                    </div>
                    <span className="text-white font-bold text-sm">Paper Trading</span>
                </div>
                <div className="h-4 w-px bg-[#1a1f2e]" />
                <OnChainAnchor />
            </div>

            {/* Right: System + Balance + Wallet */}
            <div className="flex items-center gap-4">
                <LatencyDot />
                <DemoToggle />
                {jwt && (
                    <div className="text-xs font-mono text-[#8a919e]">
                        Balance: <span className="text-[#00ff88] font-semibold">${parseFloat(balance).toLocaleString()}</span>
                    </div>
                )}
                <ConnectButton
                    chainStatus="icon"
                    showBalance={false}
                    accountStatus="address"
                />
            </div>
        </header>
    );
}
