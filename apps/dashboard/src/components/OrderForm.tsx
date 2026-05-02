'use client';

/**
 * OrderForm — symbol, side, type, size, leverage, margin preview.
 */

import { useState, memo, useCallback } from 'react';
import { useTradingStore } from '@/stores/trading';
import { api } from '@/lib/api';
import { SUPPORTED_SYMBOLS } from '@/lib/config';

function OrderFormInner() {
    const { jwt, activeSymbol, setActiveSymbol, mids, balance } = useTradingStore();
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [type, setType] = useState<'market' | 'limit'>('limit');
    const [size, setSize] = useState('');
    const [price, setPrice] = useState('');
    const [leverage, setLeverage] = useState(10);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const mid = mids[activeSymbol];
    const effectivePrice = type === 'market' ? mid || '0' : price;
    const notional = parseFloat(size || '0') * parseFloat(effectivePrice || '0');
    const marginRequired = notional / leverage;

    const handleSubmit = useCallback(async () => {
        if (!jwt) { setStatus('Please connect wallet first'); return; }
        if (!size || parseFloat(size) <= 0) { setStatus('Invalid size'); return; }
        if (type === 'limit' && (!price || parseFloat(price) <= 0)) { setStatus('Invalid price'); return; }

        setLoading(true);
        setStatus(null);
        try {
            const result = await api.placeOrder(jwt, {
                symbol: activeSymbol,
                side,
                type,
                size,
                price: effectivePrice,
            });
            if (result.status === 'ok') {
                setStatus(`✓ Order placed: ${result.orderId?.slice(0, 8)}...`);
                setSize('');
            } else {
                setStatus(`✗ ${result.error || 'Failed'}`);
            }
        } catch (err) {
            setStatus(`✗ ${(err as Error).message}`);
        }
        setLoading(false);
    }, [jwt, activeSymbol, side, type, size, price, effectivePrice, leverage]);

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] p-4 space-y-3">
            {/* Symbol selector */}
            <div className="flex gap-1">
                {SUPPORTED_SYMBOLS.map((s) => (
                    <button
                        key={s}
                        onClick={() => setActiveSymbol(s)}
                        className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${activeSymbol === s
                                ? 'bg-[#00ff8820] text-[#00ff88] border border-[#00ff8840]'
                                : 'bg-[#141822] text-[#8a919e] border border-transparent hover:border-[#1a1f2e]'
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-1 bg-[#141822] rounded-lg p-0.5">
                <button
                    onClick={() => setSide('buy')}
                    className={`py-2 text-sm font-bold rounded-md transition-all ${side === 'buy' ? 'bg-[#00ff88] text-black' : 'text-[#8a919e] hover:text-white'
                        }`}
                >
                    Long
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={`py-2 text-sm font-bold rounded-md transition-all ${side === 'sell' ? 'bg-[#ff3366] text-white' : 'text-[#8a919e] hover:text-white'
                        }`}
                >
                    Short
                </button>
            </div>

            {/* Order type */}
            <div className="flex gap-2 text-xs">
                {(['market', 'limit'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`px-3 py-1 rounded-md capitalize ${type === t ? 'bg-[#1a1f2e] text-white' : 'text-[#8a919e]'
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Price (only for limit) */}
            {type === 'limit' && (
                <div>
                    <label className="text-[10px] text-[#8a919e] uppercase tracking-wider">Price</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder={mid || '0.00'}
                        className="w-full bg-[#141822] border border-[#1a1f2e] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#00ff88] focus:outline-none"
                    />
                </div>
            )}

            {/* Size */}
            <div>
                <label className="text-[10px] text-[#8a919e] uppercase tracking-wider">Size</label>
                <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#141822] border border-[#1a1f2e] rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-[#00ff88] focus:outline-none"
                />
                {effectivePrice && size && (
                    <div className="text-[10px] text-[#8a919e] mt-1">
                        ≈ ${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                    </div>
                )}
            </div>

            {/* Leverage slider */}
            <div>
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-[#8a919e] uppercase tracking-wider">Leverage</label>
                    <span className="text-xs text-[#00ff88] font-mono">{leverage}x</span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={20}
                    value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value))}
                    className="w-full accent-[#00ff88] mt-1"
                />
            </div>

            {/* Margin preview */}
            <div className="bg-[#141822] rounded-lg p-2 text-xs space-y-1">
                <div className="flex justify-between">
                    <span className="text-[#8a919e]">Margin Required</span>
                    <span className="text-white font-mono">${marginRequired.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[#8a919e]">Available</span>
                    <span className="text-white font-mono">${parseFloat(balance).toFixed(2)}</span>
                </div>
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={loading || !jwt}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${!jwt
                        ? 'bg-[#1a1f2e] text-[#8a919e] cursor-not-allowed'
                        : side === 'buy'
                            ? 'bg-[#00ff88] text-black hover:bg-[#00dd77] active:scale-[0.98]'
                            : 'bg-[#ff3366] text-white hover:bg-[#dd2255] active:scale-[0.98]'
                    }`}
            >
                {loading ? '...' : !jwt ? 'Connect Wallet' : `${side === 'buy' ? 'Long' : 'Short'} ${activeSymbol}`}
            </button>

            {/* Status */}
            {status && (
                <div className={`text-xs text-center ${status.startsWith('✓') ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                    {status}
                </div>
            )}
        </div>
    );
}

export const OrderForm = memo(OrderFormInner);
