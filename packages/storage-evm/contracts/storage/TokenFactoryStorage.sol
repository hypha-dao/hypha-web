// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract TokenFactoryStorage is Initializable {
  address public spacesContract;
  mapping(address => bool) public isTokenDeployedByFactory;

  // Remove duplicate events - they should only be declared in the interface
}
