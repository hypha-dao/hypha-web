// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockDirectory {
  function getVotingPowerSourceContract(
    uint256
  ) external pure returns (address) {
    return address(1);
  }
}
