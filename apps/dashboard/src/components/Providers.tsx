'use client';

/**
 * Root providers: wagmi, RainbowKit, TanStack Query.
 */

import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { defineChain } from 'viem';
import { OG_CHAIN } from '@/lib/config';

const ogGalileo = defineChain({
    id: OG_CHAIN.id,
    name: OG_CHAIN.name,
    nativeCurrency: OG_CHAIN.nativeCurrency,
    rpcUrls: OG_CHAIN.rpcUrls,
    blockExplorers: OG_CHAIN.blockExplorers,
});

const wagmiConfig = createConfig({
    chains: [ogGalileo],
    transports: {
        [ogGalileo.id]: http(),
    },
    ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme({ accentColor: '#00ff88', borderRadius: 'medium' })}>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
