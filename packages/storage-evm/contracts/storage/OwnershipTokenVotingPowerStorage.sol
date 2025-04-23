// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import './TokenVotingPowerStorage.sol';

/**
 * @title OwnershipTokenVotingPowerStorage
 * @dev Storage contract for OwnershipTokenVotingPower
 */
contract OwnershipTokenVotingPowerStorage is TokenVotingPowerStorage {
  // Address of the authorized token factory
  address public ownershipTokenFactory;


  // Note: spaceTokens mapping is now inherited from TokenVotingPowerStorage
}
