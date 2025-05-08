// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IHyphaToken
 * @dev Interface for the HyphaToken contract
 */
interface IHyphaToken {
  // Events
  event SpacePaymentProcessed(
    address indexed user,
    uint256 spaceId,
    uint256 durationInDays,
    uint256 usdcAmount,
    uint256 hyphaMinted
  );

  event HyphaInvestment(
    address indexed investor,
    uint256 usdcAmount,
    uint256 hyphaPurchased
  );

  event RewardsDistributed(
    uint256 amount,
    uint256 newAccumulatedRewardPerToken
  );

  event RewardsClaimed(address indexed user, uint256 amount);

  event DistributionMultiplierUpdated(uint256 newMultiplier);

  event SpacesPaymentProcessed(
    address indexed user,
    uint256[] spaceIds,
    uint256[] durationInDays,
    uint256[] usdcAmounts,
    uint256 totalHyphaMinted
  );

  event SpacesPaymentProcessedWithHypha(
    address indexed user,
    uint256[] spaceIds,
    uint256[] durationInDays,
    uint256 totalHyphaUsed,
    uint256 totalHyphaMinted
  );

  event HyphaPriceUpdated(uint256 newPrice);

  event UsdcPerDayUpdated(uint256 newAmount);

  event HyphaPerDayUpdated(uint256 newAmount);

  // Function signatures
  function initialize(address _usdc, address _paymentTracker) external;

  function transfer(address to, uint256 amount) external returns (bool);

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool);

  function payForSpaces(
    uint256[] calldata spaceIds,
    uint256[] calldata usdcAmounts
  ) external;

  function investInHypha(uint256 usdcAmount) external;

  function updateDistributionState() external;

  function pendingRewards(address user) external view returns (uint256);

  function claimRewards() external;

  function setDistributionMultiplier(uint256 newMultiplier) external;

  function setPaymentTracker(address _paymentTracker) external;

  function payInHypha(
    uint256[] calldata spaceIds,
    uint256[] calldata hyphaAmounts
  ) external;

  function setHyphaPrice(uint256 newPrice) external;

  function setUsdcPerDay(uint256 newAmount) external;

  function setHyphaPerDay(uint256 newAmount) external;
}
