// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";
import "../src/PaperTradingVault.sol";
import "../src/Leaderboard.sol";

/**
 * @title VaultTest
 * @notice Full lifecycle test for the paper trading vault.
 *
 *   1. Deploy MockUSDC + Vault
 *   2. Deposit
 *   3. Start epoch
 *   4. Settle with Merkle root
 *   5. Claim with valid proof
 *   6. Claim with invalid proof (revert)
 *   7. Double-claim (revert)
 */
contract VaultTest is Test {
    MockUSDC public usdc;
    PaperTradingVault public vault;
    Leaderboard public leaderboard;

    address public owner;
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    uint256 constant DEPOSIT_AMOUNT = 1000e6; // 1000 USDC
    uint256 constant ALICE_FINAL = 1200e6;    // Alice profited
    uint256 constant BOB_FINAL = 800e6;       // Bob lost

    // Merkle tree for two users
    bytes32 public aliceLeaf;
    bytes32 public bobLeaf;
    bytes32 public root;

    function setUp() public {
        owner = address(this);

        // Deploy contracts
        usdc = new MockUSDC();
        vault = new PaperTradingVault(address(usdc));
        leaderboard = new Leaderboard();

        // Mint USDC to users
        usdc.mint(alice, DEPOSIT_AMOUNT);
        usdc.mint(bob, DEPOSIT_AMOUNT);

        // Compute Merkle tree (2 leaves, 1 root)
        // Using OpenZeppelin's double-hash leaf encoding
        aliceLeaf = keccak256(bytes.concat(keccak256(abi.encode(alice, ALICE_FINAL))));
        bobLeaf = keccak256(bytes.concat(keccak256(abi.encode(bob, BOB_FINAL))));

        // Sort leaves for consistent tree
        if (uint256(aliceLeaf) < uint256(bobLeaf)) {
            root = _hashPair(aliceLeaf, bobLeaf);
        } else {
            root = _hashPair(bobLeaf, aliceLeaf);
        }
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }

    // ── Deposit Tests ──────────────────────────────────────────

    function test_DepositSuccess() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(vault.deposits(alice), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(vault)), DEPOSIT_AMOUNT);
    }

    function test_DepositMinAmountReverts() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 5e6);
        vm.expectRevert("min 10 USDC");
        vault.deposit(5e6);
        vm.stopPrank();
    }

    // ── Epoch & Settlement Tests ───────────────────────────────

    function test_StartEpoch() public {
        vault.startEpoch(1 hours);
        assertGt(vault.epochDeadline(), block.timestamp);
    }

    function test_SettleBeforeDeadlineReverts() public {
        vault.startEpoch(1 hours);
        vm.expectRevert("epoch not ended");
        vault.settle(root);
    }

    function test_SettleAfterDeadline() public {
        vault.startEpoch(1 hours);
        vm.warp(block.timestamp + 1 hours + 1);
        vault.settle(root);

        assertEq(vault.merkleRoot(), root);
        assertTrue(vault.settled());
    }

    // ── Full Lifecycle ─────────────────────────────────────────

    function test_FullLifecycle() public {
        // 1. Users deposit
        vm.startPrank(alice);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Vault has 2000 USDC
        assertEq(usdc.balanceOf(address(vault)), 2000e6);

        // 2. Start epoch
        vault.startEpoch(1 hours);

        // 3. Warp past deadline and settle
        vm.warp(block.timestamp + 1 hours + 1);
        vault.settle(root);

        // 4. Alice claims with valid proof (she profited: 1200 USDC)
        bytes32[] memory aliceProof = new bytes32[](1);
        aliceProof[0] = bobLeaf;

        vm.prank(alice);
        vault.claim(ALICE_FINAL, aliceProof);

        assertEq(usdc.balanceOf(alice), ALICE_FINAL);
        assertTrue(vault.hasClaimed(alice));

        // 5. Bob claims with valid proof (he lost: 800 USDC)
        bytes32[] memory bobProof = new bytes32[](1);
        bobProof[0] = aliceLeaf;

        vm.prank(bob);
        vault.claim(BOB_FINAL, bobProof);

        assertEq(usdc.balanceOf(bob), BOB_FINAL);
    }

    // ── Claim with Invalid Proof Reverts ───────────────────────

    function test_ClaimInvalidProofReverts() public {
        _setupSettled();

        bytes32[] memory fakeProof = new bytes32[](1);
        fakeProof[0] = bytes32(uint256(0xDEAD));

        vm.prank(alice);
        vm.expectRevert("invalid proof");
        vault.claim(ALICE_FINAL, fakeProof);
    }

    // ── Double Claim Reverts ───────────────────────────────────

    function test_DoubleClaimReverts() public {
        _setupSettled();

        bytes32[] memory aliceProof = new bytes32[](1);
        aliceProof[0] = bobLeaf;

        vm.prank(alice);
        vault.claim(ALICE_FINAL, aliceProof);

        vm.prank(alice);
        vm.expectRevert("already claimed");
        vault.claim(ALICE_FINAL, aliceProof);
    }

    // ── Leaderboard Tests ──────────────────────────────────────

    function test_LeaderboardRecord() public {
        leaderboard.record(alice, 200e6, 5000e6);

        (int256 pnl, uint256 vol, uint256 trades, uint256 updated) = leaderboard.getStats(alice);
        assertEq(pnl, 200e6);
        assertEq(vol, 5000e6);
        assertEq(trades, 1);
        assertGt(updated, 0);
    }

    function test_LeaderboardMultipleRecords() public {
        leaderboard.record(alice, 100e6, 2000e6);
        leaderboard.record(alice, -50e6, 3000e6);

        (int256 pnl, uint256 vol, uint256 trades,) = leaderboard.getStats(alice);
        assertEq(pnl, 50e6);
        assertEq(vol, 5000e6);
        assertEq(trades, 2);
    }

    function test_LeaderboardTraderCount() public {
        leaderboard.record(alice, 100e6, 1000e6);
        leaderboard.record(bob, -100e6, 1000e6);
        assertEq(leaderboard.traderCount(), 2);
    }

    // ── Helper ─────────────────────────────────────────────────

    function _setupSettled() internal {
        vm.startPrank(alice);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vault.startEpoch(1 hours);
        vm.warp(block.timestamp + 1 hours + 1);
        vault.settle(root);
    }
}
