/**
 * CLI Script to manually trigger epoch settlement.
 * Usage: bun run scripts/settle.ts <epochId>
 */

import { runSettlement } from '../src/services/settlement/engine';
import { connectRedis } from '../src/lib/redis';

async function main() {
    const epochArg = process.argv[2];
    if (!epochArg) {
        console.error('Usage: bun run scripts/settle.ts <epochId>');
        console.error('Example: bun run scripts/settle.ts 1');
        process.exit(1);
    }

    const epochId = parseInt(epochArg, 10);

    await connectRedis();

    try {
        const result = await runSettlement(epochId);
        console.log('\n✅ Settlement Complete!');
        console.log(`Epoch: ${result.epochId}`);
        console.log(`Merkle Root: ${result.merkleRoot}`);
        console.log(`TxHash: ${result.txHash}`);
        console.log(`Settled ${result.entries.length} accounts.`);
    } catch (error) {
        console.error('\n❌ Settlement Failed:', error);
    }

    process.exit(0);
}

main();
