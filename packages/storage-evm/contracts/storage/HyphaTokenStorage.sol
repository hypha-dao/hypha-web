// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/ISpacePaymentTracker.sol';

contract HyphaTokenStorage {
  // Fixed max supply
  uint256 public constant MAX_SUPPLY = 555_555_555 * 10 ** 18;
  uint256 public totalMinted;

  // Core token parameters
  IERC20 public usdc;
  ISpacePaymentTracker public paymentTracker;

  // Destination addresses for transfers
  address public iexAddress; // Address to receive USDC from payForSpaces and HYPHA from payInHypha
  address public mainHyphaAddress; // Address to receive USDC from investInHypha

  // Authorized mint address (deprecated but kept for storage compatibility)
  address public mintAddress; // Address authorized to call the mint function

  // Modifiable pricing parameters (no longer constants)
  uint256 public HYPHA_PRICE_USD; // 0.25 USD with 18 decimals (default)
  uint256 public USDC_PER_DAY; // 0.367 USDC with 6 decimals (default)
  uint256 public HYPHA_PER_DAY; // ~1.47 HYPHA with 18 decimals (default)

  uint256 public distributionMultiplier; // Can be updated by governance

  // Distribution tracking
  uint256 public accumulatedRewardPerToken; // Rewards per token
  uint256 public lastUpdateTime;
  uint256 public pendingDistribution; // Tracks HYPHA waiting to be distributed

  // User-specific tracking
  mapping(address => uint256) public userRewardDebt; // User's checkpoint for rewards
  mapping(address => uint256) public unclaimedRewards; // User's unclaimed rewards

  // Transfer whitelists
  mapping(address => bool) public mintTransferWhitelist; // Addresses that can transfer with minting capability
  mapping(address => bool) public normalTransferWhitelist; // Addresses that can transfer normally without minting
}
