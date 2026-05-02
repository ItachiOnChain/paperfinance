'use client';

/**
 * CandlestickChart — TradingView Lightweight Charts.
 * Fetches OHLCV from Binance + live mid from Zustand.
 */

import { useEffect, useRef, memo } from 'react';
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, ColorType } from 'lightweight-charts';
import { useTradingStore } from '@/stores/trading';

const BINANCE_MAP: Record<string, string> = {
    'BTC-PERP': 'BTCUSDT',
    'ETH-PERP': 'ETHUSDT',
};

function CandlestickChartInner() {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartApi = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const activeSymbol = useTradingStore((s) => s.activeSymbol);

    useEffect(() => {
        if (!chartRef.current) return;

        const chart = createChart(chartRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0e17' },
                textColor: '#8a919e',
            },
            grid: {
                vertLines: { color: '#1a1f2e' },
                horzLines: { color: '#1a1f2e' },
            },
            width: chartRef.current.clientWidth,
            height: 420,
            crosshair: {
                vertLine: { color: '#00ff8850' },
                horzLine: { color: '#00ff8850' },
            },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#00ff88',
            downColor: '#ff3366',
            borderDownColor: '#ff3366',
            borderUpColor: '#00ff88',
            wickDownColor: '#ff336680',
            wickUpColor: '#00ff8880',
        });

        chartApi.current = chart;
        seriesRef.current = series;

        // Fetch OHLCV from Binance
        const binanceSymbol = BINANCE_MAP[activeSymbol] || 'BTCUSDT';
        fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1m&limit=300`)
            .then((r) => r.json())
            .then((data: any[]) => {
                const candles = data.map((k: any) => ({
                    time: (k[0] / 1000) as number,
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                }));
                series.setData(candles as any);
                chart.timeScale().fitContent();
            })
            .catch(console.error);

        const handleResize = () => {
            if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [activeSymbol]);

    // Live mid price updates → update last candle
    const mid = useTradingStore((s) => s.mids[s.activeSymbol]);
    useEffect(() => {
        if (!seriesRef.current || !mid) return;
        const price = parseFloat(mid);
        const now = Math.floor(Date.now() / 60000) * 60;
        seriesRef.current.update({
            time: now as any,
            open: price,
            high: price,
            low: price,
            close: price,
        });
    }, [mid]);

    return (
        <div className="rounded-xl bg-[#0a0e17] border border-[#1a1f2e] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1f2e]">
                <span className="text-sm font-semibold text-white">{activeSymbol}</span>
                <span className={`text-sm font-mono ${mid && parseFloat(mid) > 0 ? 'text-[#00ff88]' : 'text-[#8a919e]'}`}>
                    {mid ? `$${parseFloat(mid).toLocaleString()}` : '—'}
                </span>
            </div>
            <div ref={chartRef} />
        </div>
    );
}

export const CandlestickChart = memo(CandlestickChartInner);
