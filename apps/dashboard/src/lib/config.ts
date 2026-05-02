/** API and WebSocket config */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export const SUPPORTED_SYMBOLS = [
    'BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP', 'OP-PERP',
    'AVAX-PERP', 'DOGE-PERP', 'XRP-PERP', 'LTC-PERP', 'LINK-PERP',
    'FETCH-PERP', 'RNDR-PERP', 'TAO-PERP', 'AKT-PERP',
    'TIA-PERP', 'EIGEN-PERP', 'NEAR-PERP'
] as const;
export type Symbol = typeof SUPPORTED_SYMBOLS[number];

export const OG_CHAIN = {
    id: 16602,
    name: '0G Galileo',
    nativeCurrency: { name: 'A0GI', symbol: 'A0GI', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://evmrpc-testnet.0g.ai'] },
    },
    blockExplorers: {
        default: { name: '0G ChainScan', url: 'https://chainscan-galileo.0g.ai' },
    },
} as const;
