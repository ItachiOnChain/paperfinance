// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/PaperTradingVault.sol";
import "../src/Leaderboard.sol";

/**
 * @title DeployScript
 * @notice Deploys the full paper trading stack to 0G EVM.
 *
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $OG_RPC_URL \
 *     --private-key $DEPLOYER_PK \
 *     --broadcast \
 *     --evm-version cancun
 */
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy PaperTradingVault
        PaperTradingVault vault = new PaperTradingVault(address(usdc));
        console.log("PaperTradingVault deployed at:", address(vault));

        // 3. Deploy Leaderboard
        Leaderboard leaderboard = new Leaderboard();
        console.log("Leaderboard deployed at:", address(leaderboard));

        // 4. Mint initial test USDC to deployer (1M USDC for testing)
        usdc.mint(msg.sender, 1_000_000e6);
        console.log("Minted 1,000,000 USDC to deployer:", msg.sender);

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID   :", block.chainid);
        console.log("MockUSDC   :", address(usdc));
        console.log("Vault      :", address(vault));
        console.log("Leaderboard:", address(leaderboard));
    }
}
