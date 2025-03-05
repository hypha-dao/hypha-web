// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// A contrived example of a contract that can be upgraded
contract SpaceFactoryV1 {
  function version() public pure returns (string memory) {
    return "1.0.0";
  }
}
