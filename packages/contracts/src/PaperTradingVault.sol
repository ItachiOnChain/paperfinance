// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaperTradingVault
 * @notice Custodial vault for paper-trading competitions on 0G.
 *
 *   Lifecycle:
 *     1. Users deposit() USDC collateral
 *     2. Owner calls startEpoch(duration) to begin a trading round
 *     3. Engine runs off-chain, produces a Merkle root of final balances
 *     4. Owner calls settle(merkleRoot) after epochDeadline
 *     5. Users claim(finalBalance, proof) to withdraw their result
 *
 *   Key invariants:
 *     - Min deposit: 10 USDC (prevents dust)
 *     - Claim transfers the Merkle-proven finalBalance (profit or loss)
 *     - Vault must hold sufficient collateral for the claim
 *     - Double-claim is prevented via hasClaimed mapping
 *     - settle() can only be called after epochDeadline
 */
contract PaperTradingVault is Ownable {
    using SafeERC20 for IERC20;

    // ── State ──────────────────────────────────────────────────
    IERC20 public immutable collateral;
    bytes32 public merkleRoot;
    bool public settled;
    uint256 public epochDeadline;

    mapping(address => uint256) public deposits;
    mapping(address => bool) public hasClaimed;

    uint256 public totalDeposited;

    // ── Constants ──────────────────────────────────────────────
    uint256 public constant MIN_DEPOSIT = 10e6; // 10 USDC (6 decimals)

    // ── Events ─────────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event EpochStarted(uint256 deadline);
    event Settled(bytes32 merkleRoot);
    event Claimed(address indexed user, uint256 finalBalance);
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    // ── Constructor ────────────────────────────────────────────
    constructor(address _collateral) Ownable(msg.sender) {
        require(_collateral != address(0), "zero collateral address");
        collateral = IERC20(_collateral);
    }

    // ── User Actions ───────────────────────────────────────────

    /**
     * @notice Deposit USDC into the vault for paper trading.
     * @param amount Amount in 6-decimal USDC units
     */
    function deposit(uint256 amount) external {
        require(amount >= MIN_DEPOSIT, "min 10 USDC");
        require(!settled, "epoch settled");

        collateral.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Claim your final balance after settlement.
     * @param finalBalance Your Merkle-proven final balance
     * @param proof        Merkle proof for your leaf
     */
    function claim(uint256 finalBalance, bytes32[] calldata proof) external {
        require(settled, "not settled");
        require(!hasClaimed[msg.sender], "already claimed");
        require(deposits[msg.sender] > 0, "no deposit");

        // Verify Merkle proof: leaf = keccak256(abi.encodePacked(user, finalBalance))
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, finalBalance))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "invalid proof");

        // Ensure vault has sufficient collateral
        require(
            collateral.balanceOf(address(this)) >= finalBalance,
            "insufficient vault balance"
        );

        hasClaimed[msg.sender] = true;
        collateral.safeTransfer(msg.sender, finalBalance);

        emit Claimed(msg.sender, finalBalance);
    }

    // ── Owner Actions ──────────────────────────────────────────

    /**
     * @notice Start a new trading epoch with a deadline.
     * @param duration Duration in seconds from now
     */
    function startEpoch(uint256 duration) external onlyOwner {
        require(!settled, "already settled");
        require(duration > 0, "zero duration");

        epochDeadline = block.timestamp + duration;
        emit EpochStarted(epochDeadline);
    }

    /**
     * @notice Settle the epoch with a Merkle root of final balances.
     *         Can only be called after epochDeadline has passed.
     * @param _merkleRoot Root hash of the balance tree
     */
    function settle(bytes32 _merkleRoot) external onlyOwner {
        require(!settled, "already settled");
        require(epochDeadline > 0, "epoch not started");
        require(block.timestamp >= epochDeadline, "epoch not ended");
        require(_merkleRoot != bytes32(0), "zero root");

        merkleRoot = _merkleRoot;
        settled = true;

        emit Settled(_merkleRoot);
    }

    /**
     * @notice Emergency withdraw all collateral (owner only, for recovery).
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = collateral.balanceOf(address(this));
        require(balance > 0, "nothing to withdraw");

        collateral.safeTransfer(owner(), balance);
        emit EmergencyWithdraw(owner(), balance);
    }
}
