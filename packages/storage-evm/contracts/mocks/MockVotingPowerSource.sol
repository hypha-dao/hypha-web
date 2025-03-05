// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockVotingPowerSource {
  function getVotingPower(address, uint256) external pure returns (uint256) {
    return 100;
  }

  function getTotalVotingPower(uint256) external pure returns (uint256) {
    return 1000;
  }
}
