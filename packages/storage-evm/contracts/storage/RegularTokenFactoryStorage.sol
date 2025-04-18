// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract RegularTokenFactoryStorage is Initializable {
  address public spacesContract;
  address public votingPowerContract;
  mapping(address => bool) public isTokenDeployedByFactory;
} 