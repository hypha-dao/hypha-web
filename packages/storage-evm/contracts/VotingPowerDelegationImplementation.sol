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

    // If already delegated to the same address, no-op to save gas
    if (
      userHasDelegated[msg.sender][_spaceId] &&
      userDelegates[msg.sender][_spaceId] == _delegate
    ) {
      return;
    }

    // Remove previous delegation if exists
    if (userHasDelegated[msg.sender][_spaceId]) {
      _removeDelegation(msg.sender, _spaceId);
    }

    // Set new delegation
    userDelegates[msg.sender][_spaceId] = _delegate;
    userHasDelegated[msg.sender][_spaceId] = true;

    // Add to delegate's list
    delegatorIndex[msg.sender][_spaceId][_delegate] = delegateToDelegators[
      _delegate
    ][_spaceId].length;
    delegateToDelegators[_delegate][_spaceId].push(msg.sender);

    if (!isDelegateInSpace[_spaceId][_delegate]) {
      isDelegateInSpace[_spaceId][_delegate] = true;
      spaceDelegates[_spaceId].push(_delegate);
      spaceDelegateIndex[_spaceId][_delegate] =
        spaceDelegates[_spaceId].length -
        1;
      delegateToSpaces[_delegate].push(_spaceId);
      delegateToSpaceIndex[_delegate][_spaceId] =
        delegateToSpaces[_delegate].length -
        1;
    }

    emit VotingPowerDelegated(msg.sender, _delegate, _spaceId);
  }

  /**
   * @dev Remove delegation and return voting power to self
   * @param _spaceId The space ID for which to remove delegation
   */
  function undelegate(uint256 _spaceId) external override {
    require(_spaceId > 0, 'Invalid space ID');
    require(userHasDelegated[msg.sender][_spaceId], 'No delegation to remove');

    address previousDelegate = userDelegates[msg.sender][_spaceId];
    _removeDelegation(msg.sender, _spaceId);

    emit VotingPowerUndelegated(msg.sender, previousDelegate, _spaceId);
  }

  /**
   * @dev Internal function to remove delegation
   */
  function _removeDelegation(address _user, uint256 _spaceId) internal {
    address delegateAddress = userDelegates[_user][_spaceId];

    // Remove from delegate's list
    address[] storage delegators = delegateToDelegators[delegateAddress][
      _spaceId
    ];
    uint256 index = delegatorIndex[_user][_spaceId][delegateAddress];
    uint256 lastIndex = delegators.length - 1;

    if (index != lastIndex) {
      address lastDelegator = delegators[lastIndex];
      delegators[index] = lastDelegator;
      delegatorIndex[lastDelegator][_spaceId][delegateAddress] = index;
    }

    delegators.pop();
    delete delegatorIndex[_user][_spaceId][delegateAddress];

    if (delegators.length == 0) {
      uint256 indexToRemove = spaceDelegateIndex[_spaceId][delegateAddress];
      uint256 lastIndexDelegates = spaceDelegates[_spaceId].length - 1;

      if (indexToRemove != lastIndexDelegates) {
        address lastDelegate = spaceDelegates[_spaceId][lastIndexDelegates];
        spaceDelegates[_spaceId][indexToRemove] = lastDelegate;
        spaceDelegateIndex[_spaceId][lastDelegate] = indexToRemove;
      }

      spaceDelegates[_spaceId].pop();
      delete isDelegateInSpace[_spaceId][delegateAddress];
      delete spaceDelegateIndex[_spaceId][delegateAddress];

      // Remove from delegateToSpaces
      uint256 spaceIndexToRemove = delegateToSpaceIndex[delegateAddress][
        _spaceId
      ];
      uint256 lastSpaceIndex = delegateToSpaces[delegateAddress].length - 1;

      if (spaceIndexToRemove != lastSpaceIndex) {
        uint256 lastSpaceId = delegateToSpaces[delegateAddress][lastSpaceIndex];
        delegateToSpaces[delegateAddress][spaceIndexToRemove] = lastSpaceId;
        delegateToSpaceIndex[delegateAddress][lastSpaceId] = spaceIndexToRemove;
      }

      delegateToSpaces[delegateAddress].pop();
      delete delegateToSpaceIndex[delegateAddress][_spaceId];
    }

    // Clean up user delegation
    delete userDelegates[_user][_spaceId];
    delete userHasDelegated[_user][_spaceId];
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
    if (userHasDelegated[_user][_spaceId]) {
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
    return userHasDelegated[_user][_spaceId];
  }

  /**
   * @dev Check if a user has delegated their voting power in a space (same as isDelegated)
   * @param _user The user address
   * @param _spaceId The space ID
   * @return True if the user has delegated
   */
  function hasDelegated(
    address _user,
    uint256 _spaceId
  ) external view override returns (bool) {
    return userHasDelegated[_user][_spaceId];
  }

  /**
   * @dev Get delegation information for a user in a space
   * @param _user The user address
   * @param _spaceId The space ID
   * @return delegateAddress The delegate address
   * @return hasDelegatedStatus Whether the user has delegated
   */
  function getDelegationInfo(
    address _user,
    uint256 _spaceId
  )
    external
    view
    override
    returns (address delegateAddress, bool hasDelegatedStatus)
  {
    hasDelegatedStatus = userHasDelegated[_user][_spaceId];
    delegateAddress = hasDelegatedStatus
      ? userDelegates[_user][_spaceId]
      : _user;
  }

  /**
   * @dev Get all delegate addresses for a specific space
   * @param _spaceId The space ID
   * @return Array of delegate addresses
   */
  function getDelegatesForSpace(
    uint256 _spaceId
  ) external view override returns (address[] memory) {
    return spaceDelegates[_spaceId];
  }

  /**
   * @dev Get all space IDs for which a user is a delegate
   * @param _delegate The delegate address
   * @return Array of space IDs
   */
  function getSpacesForDelegate(
    address _delegate
  ) external view returns (uint256[] memory) {
    return delegateToSpaces[_delegate];
  }
}
