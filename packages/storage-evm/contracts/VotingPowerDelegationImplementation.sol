// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/VotingPowerDelegationStorage.sol';
import './interfaces/IVotingPowerDelegation.sol';

/**
 * @title VotingPowerDelegationImplementation
 * @dev Manages delegation of voting power across different voting power sources
 */
contract VotingPowerDelegationImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  VotingPowerDelegationStorage,
  IVotingPowerDelegation
{
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
   * @dev Delegate voting power to another address
   * @param _delegate The address to delegate voting power to
   * @param _spaceId The space ID for which to delegate voting power
   */
  function delegate(address _delegate, uint256 _spaceId) external override {
    require(_delegate != address(0), 'Cannot delegate to zero address');
    require(_delegate != msg.sender, 'Cannot delegate to self');
    require(_spaceId > 0, 'Invalid space ID');

    // Remove previous delegation if exists
    if (hasDelegated[msg.sender][_spaceId]) {
      _removeDelegation(msg.sender, _spaceId);
    }

    // Set new delegation
    userDelegates[msg.sender][_spaceId] = _delegate;
    hasDelegated[msg.sender][_spaceId] = true;

    // Add to delegate's list
    delegatorIndex[msg.sender][_spaceId][_delegate] = delegateToDelegators[
      _delegate
    ][_spaceId].length;
    delegateToDelegators[_delegate][_spaceId].push(msg.sender);

    emit VotingPowerDelegated(msg.sender, _delegate, _spaceId);
  }

  /**
   * @dev Remove delegation and return voting power to self
   * @param _spaceId The space ID for which to remove delegation
   */
  function undelegate(uint256 _spaceId) external override {
    require(_spaceId > 0, 'Invalid space ID');
    require(hasDelegated[msg.sender][_spaceId], 'No delegation to remove');

    address previousDelegate = userDelegates[msg.sender][_spaceId];
    _removeDelegation(msg.sender, _spaceId);

    emit VotingPowerUndelegated(msg.sender, previousDelegate, _spaceId);
  }

  /**
   * @dev Internal function to remove delegation
   */
  function _removeDelegation(address _user, uint256 _spaceId) internal {
    address delegate = userDelegates[_user][_spaceId];

    // Remove from delegate's list
    address[] storage delegators = delegateToDelegators[delegate][_spaceId];
    uint256 index = delegatorIndex[_user][_spaceId][delegate];
    uint256 lastIndex = delegators.length - 1;

    if (index != lastIndex) {
      address lastDelegator = delegators[lastIndex];
      delegators[index] = lastDelegator;
      delegatorIndex[lastDelegator][_spaceId][delegate] = index;
    }

    delegators.pop();
    delete delegatorIndex[_user][_spaceId][delegate];

    // Clean up user delegation
    delete userDelegates[_user][_spaceId];
    delete hasDelegated[_user][_spaceId];
  }

  /**
   * @dev Get the delegate for a user in a specific space
   * @param _user The user address
   * @param _spaceId The space ID
   * @return The delegate address (returns _user if no delegation)
   */
  function getDelegate(
    address _user,
    uint256 _spaceId
  ) external view override returns (address) {
    if (hasDelegated[_user][_spaceId]) {
      return userDelegates[_user][_spaceId];
    }
    return _user;
  }

  /**
   * @dev Get all addresses that have delegated to a specific delegate
   * @param _delegate The delegate address
   * @param _spaceId The space ID
   * @return Array of delegator addresses
   */
  function getDelegators(
    address _delegate,
    uint256 _spaceId
  ) external view override returns (address[] memory) {
    return delegateToDelegators[_delegate][_spaceId];
  }

  /**
   * @dev Check if a user has delegated their voting power in a space
   * @param _user The user address
   * @param _spaceId The space ID
   * @return True if the user has delegated
   */
  function isDelegated(
    address _user,
    uint256 _spaceId
  ) external view override returns (bool) {
    return hasDelegated[_user][_spaceId];
  }

  /**
   * @dev Get delegation information for a user in a space
   * @param _user The user address
   * @param _spaceId The space ID
   * @return delegate The delegate address
   * @return isDelegated Whether the user has delegated
   */
  function getDelegationInfo(
    address _user,
    uint256 _spaceId
  ) external view override returns (address delegate, bool isDelegated) {
    isDelegated = hasDelegated[_user][_spaceId];
    delegate = isDelegated ? userDelegates[_user][_spaceId] : _user;
  }
}
