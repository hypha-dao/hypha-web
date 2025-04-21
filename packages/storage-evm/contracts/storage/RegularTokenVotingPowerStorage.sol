// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import './TokenVotingPowerStorage.sol';

/**
 * @title RegularTokenVotingPowerStorage
 * @dev Storage for TokenVotingPowerImplementation
 */
contract RegularTokenVotingPowerStorage is TokenVotingPowerStorage {
  // Storage for the factory
  address public tokenFactory;

  // No events here - they should be defined in interfaces only
}
