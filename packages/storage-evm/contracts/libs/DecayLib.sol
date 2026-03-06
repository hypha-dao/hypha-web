// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DecayLib
 * @dev External library for token balance decay computation.
 *      Deployed separately; called via DELEGATECALL — its bytecode does NOT
 *      count toward the 24 KiB contract size limit of the calling token.
 */
library DecayLib {
  /**
   * @dev Compute the balance after decay using binary exponentiation.
   *      balance * ((10000 - decayPercentage) / 10000) ^ periodsPassed
   * @param currentBalance  Raw ERC20 balance before decay
   * @param lastAppliedTs   Timestamp when decay was last materialized
   * @param decayPct        Decay percentage in basis points (0-10000)
   * @param decayRate       Interval in seconds between decay periods
   * @return The balance after applying all pending decay periods
   */
  function computeDecayedBalance(
    uint256 currentBalance,
    uint256 lastAppliedTs,
    uint256 decayPct,
    uint256 decayRate
  ) external view returns (uint256) {
    if (decayRate == 0) return currentBalance;
    if (currentBalance == 0 || lastAppliedTs == 0) return currentBalance;

    uint256 timeSince = block.timestamp - lastAppliedTs;
    uint256 periods = timeSince / decayRate;
    if (periods == 0) return currentBalance;

    uint256 factor = 10000 - decayPct;
    uint256 acc = 10000;
    uint256 n = periods;
    while (n > 0) {
      if ((n & 1) == 1) {
        acc = (acc * factor) / 10000;
      }
      factor = (factor * factor) / 10000;
      n >>= 1;
    }

    return (currentBalance * acc) / 10000;
  }
}
