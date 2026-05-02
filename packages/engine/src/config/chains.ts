/**
 * Multi-chain configuration abstraction.
 *
 * Replaces all Hyperliquid-specific endpoint references with a
 * chain-agnostic config that can be extended to any EVM network.
 */

export interface ChainConfig {
    /** HTTP JSON-RPC endpoint */
    rpcUrl: string;
    /** WebSocket JSON-RPC endpoint */
    wsRpcUrl: string;
    /** Numeric chain ID (e.g. 16661 for 0G Mainnet) */
    chainId: number;
    /** Block explorer base URL */
    explorerUrl: string;
    /** Deployed PaperVault contract address */
    vaultAddress: string;
}

/**
 * 0G Mainnet — production chain.
 * Chain ID 16661 · EVM-compatible · Cancun fork
 */
export const OG_MAINNET: ChainConfig = {
    rpcUrl: process.env.OG_RPC_URL || 'https://evmrpc.0g.ai',
    wsRpcUrl: process.env.OG_WS_RPC_URL || 'wss://evmrpc.0g.ai/ws',
    chainId: 16661,
    explorerUrl: 'https://chainscan.0g.ai',
    vaultAddress: process.env.VAULT_ADDRESS || '',
};

/**
 * 0G Galileo Testnet — development / staging chain.
 * Chain ID 16602 · EVM-compatible · Cancun fork
 */
export const OG_TESTNET: ChainConfig = {
    rpcUrl: 'https://evmrpc-testnet.0g.ai',
    wsRpcUrl: 'wss://evmrpc-testnet.0g.ai/ws',
    chainId: 16602,
    explorerUrl: 'https://chainscan-galileo.0g.ai',
    vaultAddress: '',
};

/**
 * Resolve the active chain config from the OG_CHAIN_ID env var.
 * Defaults to OG_MAINNET if unrecognised.
 */
export function getChainConfig(): ChainConfig {
    const id = Number(process.env.OG_CHAIN_ID || 16661);
    switch (id) {
        case 16602:
            return OG_TESTNET;
        case 16661:
        default:
            return OG_MAINNET;
    }
}
