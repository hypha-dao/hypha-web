// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Minimal mock for DAOSpaceFactory — just enough for Token Backing Vault tests.
 */
contract MockDAOSpaceFactory {
  mapping(uint256 => address) public executors;
  mapping(uint256 => mapping(address => bool)) public members;

  function setExecutor(uint256 spaceId, address executor) external {
    executors[spaceId] = executor;
  }

  function setMember(
    uint256 spaceId,
    address account,
    bool isMember_
  ) external {
    members[spaceId][account] = isMember_;
  }

  function getSpaceExecutor(uint256 spaceId) external view returns (address) {
    return executors[spaceId];
  }

  function isMember(
    uint256 spaceId,
    address account
  ) external view returns (bool) {
    return members[spaceId][account];
  }
}


