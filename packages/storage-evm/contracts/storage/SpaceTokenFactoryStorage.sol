// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract SpaceTokenFactoryStorage is Initializable {
  address public spacesContract;
  address public votingPowerContract;
  mapping(address => bool) public isTokenDeployedByFactory;

  mapping(uint256 => address) public spaceTokens;

  mapping(uint256 => address[]) public allSpaceTokens;
}
