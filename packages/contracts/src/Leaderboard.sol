// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Leaderboard
 * @notice On-chain leaderboard tracking trader performance.
 *         Owner (engine backend) records PnL and volume per address.
 */
contract Leaderboard is Ownable {
    struct Stats {
        int256 totalPnl;
        uint256 totalVolume;
        uint256 tradesCount;
        uint256 lastUpdated;
    }

    mapping(address => Stats) public stats;
    address[] public traders;
    mapping(address => bool) private isTrader;

    // ── Events ─────────────────────────────────────────────────
    event StatsRecorded(address indexed trader, int256 pnl, uint256 volume);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Record a trader's performance. Owner only.
     * @param trader Address of the trader
     * @param pnl    Realized PnL (signed, 6-decimal USDC)
     * @param volume Notional volume traded (6-decimal USDC)
     */
    function record(address trader, int256 pnl, uint256 volume) external onlyOwner {
        require(trader != address(0), "zero address");

        if (!isTrader[trader]) {
            isTrader[trader] = true;
            traders.push(trader);
        }

        Stats storage s = stats[trader];
        s.totalPnl += pnl;
        s.totalVolume += volume;
        s.tradesCount += 1;
        s.lastUpdated = block.timestamp;

        emit StatsRecorded(trader, pnl, volume);
    }

    /**
     * @notice Get a trader's stats.
     */
    function getStats(address trader)
        external
        view
        returns (int256 totalPnl, uint256 totalVolume, uint256 tradesCount, uint256 lastUpdated)
    {
        Stats storage s = stats[trader];
        return (s.totalPnl, s.totalVolume, s.tradesCount, s.lastUpdated);
    }

    /**
     * @notice Get total number of unique traders.
     */
    function traderCount() external view returns (uint256) {
        return traders.length;
    }
}
