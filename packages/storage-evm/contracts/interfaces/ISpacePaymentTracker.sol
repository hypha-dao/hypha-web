// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISpacePaymentTracker {
  function updateSpacePayment(
    address user,
    uint256 spaceId,
    uint256 durationInDays
  ) external;

  function activateFreeTrial(uint256 spaceId) external;

  function isSpaceActive(uint256 spaceId) external view returns (bool);

  function getSpaceExpiryTime(uint256 spaceId) external view returns (uint256);

  function hasUsedFreeTrial(uint256 spaceId) external view returns (bool);

  function extendFreeTrial(uint256 spaceId, uint256 durationInDays) external;

  function setCustomExpiryTime(uint256 spaceId, uint256 newExpiryTime) external;

  function hasSpacePaid(uint256 spaceId) external view returns (bool);

  function setSpaceAsPaid(uint256 spaceId) external;
}
