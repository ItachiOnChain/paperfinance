/**
 * Normalize an EVM address to checksummed format.
 * Uses viem's getAddress() which validates and checksums.
 */
import { getAddress } from 'viem';

export type EvmAddress = `0x${string}`;

/**
 * Validate and normalize an EVM address.
 * @throws if input is not a valid EVM address
 */
export function normalizeAddress(input: string): EvmAddress {
    if (!input || typeof input !== 'string') {
        throw new Error(`Invalid address: ${input}`);
    }
    try {
        return getAddress(input) as EvmAddress;
    } catch {
        throw new Error(`Invalid EVM address: ${input}`);
    }
}
