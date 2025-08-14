// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/**
 * @title VotingPowerDelegationStorage
 * @dev Storage for VotingPowerDelegationImplementation
 */
contract VotingPowerDelegationStorage is Initializable {
  // Mapping from (user, spaceId) => delegate
  mapping(address => mapping(uint256 => address)) public userDelegates;

  // Mapping from (delegate, spaceId) => array of delegators
  mapping(address => mapping(uint256 => address[])) public delegateToDelegators;

  // Mapping to track if a user has delegated in a space (for efficient cleanup)
  mapping(address => mapping(uint256 => bool)) public hasDelegated;

  // Mapping to find index of delegator in delegate's array for efficient removal
  mapping(address => mapping(uint256 => mapping(address => uint256)))
    internal delegatorIndex;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[46] private __gap;
}
