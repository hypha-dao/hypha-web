// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract OwnershipTokenFactoryStorage is Initializable {
  address public spacesContract;
  address public votingPowerContract;
  mapping(address => bool) public isTokenDeployedByFactory;

  // Mapping from spaceId to the most recently deployed token address
  mapping(uint256 => address) public spaceTokens;

  // New storage variable: Mapping from spaceId to array of all deployed token addresses
  mapping(uint256 => address[]) public allSpaceTokens;
}
