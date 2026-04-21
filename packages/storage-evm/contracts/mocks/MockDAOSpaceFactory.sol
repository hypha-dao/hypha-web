// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Minimal mock for DAOSpaceFactory — just enough for Token Backing Vault tests.
 */
contract MockDAOSpaceFactory {
  mapping(uint256 => address) public executors;
  mapping(uint256 => mapping(address => bool)) public members;
  mapping(address => uint256[]) private _memberSpaces;
  mapping(address => mapping(uint256 => bool)) private _memberHasSpace;

  function setExecutor(uint256 spaceId, address executor) external {
    executors[spaceId] = executor;
  }

  function setMember(
    uint256 spaceId,
    address account,
    bool isMember_
  ) external {
    bool wasMember = members[spaceId][account];
    members[spaceId][account] = isMember_;

    if (isMember_ && !wasMember) {
      if (!_memberHasSpace[account][spaceId]) {
        _memberHasSpace[account][spaceId] = true;
        _memberSpaces[account].push(spaceId);
      }
    } else if (!isMember_ && wasMember) {
      if (_memberHasSpace[account][spaceId]) {
        _memberHasSpace[account][spaceId] = false;
        uint256[] storage spaces = _memberSpaces[account];
        for (uint256 i = 0; i < spaces.length; i++) {
          if (spaces[i] == spaceId) {
            spaces[i] = spaces[spaces.length - 1];
            spaces.pop();
            break;
          }
        }
      }
    }
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

  function getMemberSpaces(
    address account
  ) external view returns (uint256[] memory) {
    return _memberSpaces[account];
  }
}


