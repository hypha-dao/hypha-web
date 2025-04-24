// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/ISpacesContract.sol';

contract HyphaTokenStorage {
  // Fixed max supply
  uint256 public constant MAX_SUPPLY = 555_555_555 * 10 ** 18;
  uint256 public totalMinted;

  // Core token parameters
  IERC20 public usdc;
  uint256 public constant HYPHA_PRICE_USD = 25 * 10 ** 16; // 0.25 USD with 18 decimals
  uint256 public distributionMultiplier; // Can be updated by governance

  // External contracts
  ISpacesContract public spacesContract;

  // Distribution tracking
  uint256 public accumulatedRewardPerToken; // Rewards per token
  uint256 public lastUpdateTime;
  uint256 public pendingDistribution; // Tracks HYPHA waiting to be distributed

  // User-specific tracking
  mapping(address => uint256) public userRewardDebt; // User's checkpoint for rewards
  mapping(address => uint256) public unclaimedRewards; // User's unclaimed rewards
}
