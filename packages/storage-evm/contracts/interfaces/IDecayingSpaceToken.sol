// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDecayingSpaceToken {
  function balanceOf(address account) external view returns (uint256);

  function decayPercentage() external view returns (uint256);

  function applyDecay(address user) external;

  /**
   * @dev Returns the total supply with decay applied to all balances
   * @return The current total supply after decay calculations
   */
  function getDecayedTotalSupply() external view returns (uint256);
}
