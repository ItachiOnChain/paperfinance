/**
 * Viem client configuration for 0G EVM.
 *
 * Provides a public client (read) and wallet client (write) for
 * interacting with the 0G testnet.
 */

import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../config';

// ── Define 0G testnet chain ────────────────────────────────
export const zgTestnet = defineChain({
    id: config.OG_CHAIN_ID,
    name: '0G Galileo Testnet',
    nativeCurrency: {
        name: '0G Token',
        symbol: 'A0GI',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [config.OG_RPC_URL],
        },
    },
    blockExplorers: {
        default: {
            name: '0G ChainScan',
            url: 'https://chainscan-galileo.0g.ai',
        },
    },
    testnet: true,
});

// ── Public client (read-only) ──────────────────────────────
export const publicClient = createPublicClient({
    chain: zgTestnet,
    transport: http(config.OG_RPC_URL),
});

// ── Wallet client (write, requires DEPLOYER_PK) ────────────
export function getWalletClient() {
    if (!config.DEPLOYER_PK || config.DEPLOYER_PK.length === 0) {
        throw new Error('DEPLOYER_PK not set — cannot create wallet client');
    }

    const pk = config.DEPLOYER_PK.startsWith('0x')
        ? config.DEPLOYER_PK
        : `0x${config.DEPLOYER_PK}`;

    const account = privateKeyToAccount(pk as `0x${string}`);

    return createWalletClient({
        account,
        chain: zgTestnet,
        transport: http(config.OG_RPC_URL),
    });
}
