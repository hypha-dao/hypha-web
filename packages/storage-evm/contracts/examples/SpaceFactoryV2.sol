// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// A contrived example of a contract that can be upgraded
contract SpaceFactoryV2 {
  string public name;

  function version() public pure returns (string memory) {
    return "2.0.0";

  }

  function setName(string memory _name) public {
    name = _name;
  }
}
