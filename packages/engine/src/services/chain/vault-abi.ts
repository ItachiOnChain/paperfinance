/**
 * PaperTradingVault ABI — only the events and functions we need.
 */

export const VAULT_ABI = [
    // Events
    {
        type: 'event',
        name: 'Deposited',
        inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Settled',
        inputs: [
            { name: 'merkleRoot', type: 'bytes32', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'Claimed',
        inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'finalBalance', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'EpochStarted',
        inputs: [
            { name: 'deadline', type: 'uint256', indexed: false },
        ],
    },
    // Read functions
    {
        type: 'function',
        name: 'deposits',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'settled',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'merkleRoot',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'hasClaimed',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'epochDeadline',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
    // Write functions
    {
        type: 'function',
        name: 'settle',
        inputs: [{ name: '_merkleRoot', type: 'bytes32' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'startEpoch',
        inputs: [{ name: 'duration', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
] as const;
