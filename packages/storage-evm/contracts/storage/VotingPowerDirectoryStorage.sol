// VotingPowerDirectoryStorage.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VotingPowerDirectoryStorage is Initializable {
    mapping(uint256 => address) public votingPowerSources;
    uint256 public sourceCounter;

}
