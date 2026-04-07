// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './interfaces/ISpacePaymentTracker.sol';

contract SpacePaymentTracker is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ISpacePaymentTracker
{
  // Space payment information
  struct SpacePayment {
    uint256 expiryTime;
    bool freeTrialUsed;
  }

  // Mapping from space ID to payment info
  mapping(uint256 => SpacePayment) public spacePayments;

  // Constants
  uint256 public constant FREE_TRIAL_DAYS = 30;

  // Authorized contracts
  address public hyphaTokenContract;
  address public proposalsContract;

  // Mapping from space ID to payment status
  mapping(uint256 => bool) private _spaceHasPaid;

  // Events
  event SpacePaymentUpdated(uint256 indexed spaceId, uint256 expiryTime);
  event FreeTrialActivated(uint256 indexed spaceId);
  event ContractAuthorized(address indexed contractAddress, string role);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Set the authorized contracts
   * @param _hyphaTokenContract Address of the HyphaToken contract
   * @param _proposalsContract Address of the Proposals contract
   */
  function setAuthorizedContracts(
    address _hyphaTokenContract,
    address _proposalsContract
  ) external onlyOwner {
    require(_hyphaTokenContract != address(0), 'Invalid HyphaToken address');
    require(_proposalsContract != address(0), 'Invalid Proposals address');

    hyphaTokenContract = _hyphaTokenContract;
    proposalsContract = _proposalsContract;

    emit ContractAuthorized(_hyphaTokenContract, 'HyphaToken');
    emit ContractAuthorized(_proposalsContract, 'Proposals');
  }

  /**
   * @dev Update payment for a space - only callable by HyphaToken
   * @param spaceId ID of the space being paid for
   * @param durationInDays Duration in days to add to subscription
   */
  function updateSpacePayment(
    address /* user */,
    uint256 spaceId,
    uint256 durationInDays
  ) external override {
    // Only allow calls from the HyphaToken contract
    require(
      msg.sender == hyphaTokenContract,
      'Only HyphaToken can update payment'
    );

    SpacePayment storage payment = spacePayments[spaceId];
    uint256 currentTime = block.timestamp;

    // If payment expired, start from current time
    if (payment.expiryTime < currentTime) {
      payment.expiryTime = currentTime + (durationInDays * 1 days);
    } else {
      // Add to existing expiry time
      payment.expiryTime += (durationInDays * 1 days);
    }

    if (!_spaceHasPaid[spaceId]) {
      _spaceHasPaid[spaceId] = true;
    }

    emit SpacePaymentUpdated(spaceId, payment.expiryTime);
  }

  /**
   * @dev Activate free trial for a space - only callable by Proposals contract
   * @param spaceId ID of the space for free trial
   */
  function activateFreeTrial(uint256 spaceId) external override {
    // Only allow calls from the Proposals contract
    require(
      msg.sender == proposalsContract,
      'Only Proposals can activate free trial'
    );

    SpacePayment storage payment = spacePayments[spaceId];
    require(!payment.freeTrialUsed, 'Free trial already used');

    payment.freeTrialUsed = true;

    // Set expiry to current time + free trial period
    uint256 currentTime = block.timestamp;
    uint256 newExpiry = currentTime + (FREE_TRIAL_DAYS * 1 days);
    if (newExpiry > payment.expiryTime) {
      payment.expiryTime = newExpiry;
    }

    emit FreeTrialActivated(spaceId);
  }

  /**
   * @dev Check if a space has an active subscription
   * @param spaceId ID of the space to check
   * @return bool Whether the space is active
   */
  function isSpaceActive(
    uint256 spaceId
  ) external view override returns (bool) {
    return spacePayments[spaceId].expiryTime >= block.timestamp;
  }

  /**
   * @dev Get space expiry time
   * @param spaceId ID of the space
   * @return Expiry timestamp
   */
  function getSpaceExpiryTime(
    uint256 spaceId
  ) external view override returns (uint256) {
    return spacePayments[spaceId].expiryTime;
  }

  /**
   * @dev Check if free trial has been used
   * @param spaceId ID of the space
   * @return bool Whether free trial has been used
   */
  function hasUsedFreeTrial(
    uint256 spaceId
  ) external view override returns (bool) {
    return spacePayments[spaceId].freeTrialUsed;
  }

  /**
   * @dev Check if a space has ever been paid for
   * @param spaceId ID of the space to check
   * @return bool Whether the space has been paid for
   */
  function hasSpacePaid(uint256 spaceId) external view override returns (bool) {
    return _spaceHasPaid[spaceId];
  }

  /**
   * @dev Manually set a space as paid - only callable by owner
   * @param spaceId ID of the space to update
   */
  function setSpaceAsPaid(uint256 spaceId) external override onlyOwner {
    _spaceHasPaid[spaceId] = true;
  }

  /**
   * @dev Extend free trial for a space - only callable by owner
   * @param spaceId ID of the space to extend
   * @param durationInDays Duration in days to extend the subscription
   */
  function extendFreeTrial(
    uint256 spaceId,
    uint256 durationInDays
  ) external override onlyOwner {
    require(durationInDays > 0, 'Duration must be greater than 0');

    SpacePayment storage payment = spacePayments[spaceId];
    require(payment.freeTrialUsed, 'Space has not used free trial');

    uint256 currentTime = block.timestamp;

    // If payment expired, start from current time
    if (payment.expiryTime < currentTime) {
      payment.expiryTime = currentTime + (durationInDays * 1 days);
    } else {
      // Add to existing expiry time
      payment.expiryTime += (durationInDays * 1 days);
    }

    emit SpacePaymentUpdated(spaceId, payment.expiryTime);
  }

  /**
   * @dev Set a custom expiry time for a space - only callable by owner
   * @param spaceId ID of the space to update
   * @param newExpiryTime The new expiry timestamp
   */
  function setCustomExpiryTime(
    uint256 spaceId,
    uint256 newExpiryTime
  ) external override onlyOwner {
    SpacePayment storage payment = spacePayments[spaceId];
    payment.expiryTime = newExpiryTime;

    emit SpacePaymentUpdated(spaceId, payment.expiryTime);
  }
}
