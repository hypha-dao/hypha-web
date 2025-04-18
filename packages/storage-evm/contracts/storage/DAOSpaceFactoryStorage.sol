// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

interface IDirectory {
  function joincheck(
    uint256 _spaceId,
    uint256 _joinMethod,
    address _userAddress
  ) external view returns (bool);
}

// Add this for the hasToken function
interface SpaceToken {
  function spaceId() external view returns (uint256);
}

contract DAOSpaceFactoryStorage is Initializable {
  struct Space {
    uint256 unity;
    uint256 quorum;
    uint256 votingPowerSource;
    address[] tokenAddresses; // Keep for backward compatibility
    address[] members;
    uint256 exitMethod;
    uint256 joinMethod;
    uint256 createdAt;
    address creator;
    address executor;
  }

  mapping(uint256 => Space) public spaces;
  uint256 public spaceCounter;
  IDirectory public directoryContract;
  address public tokenFactoryAddress;
  address public joinMethodDirectoryAddress;
  address public proposalManagerAddress;
  address public exitMethodDirectoryAddress;

  // --- Restore factory addresses to their original position --

  struct SpaceMembers {
    address[] spaceMemberAddresses;
    mapping(address => bool) isSpaceMember;
  }
  mapping(uint256 => SpaceMembers) internal spaceMembers;
  mapping(address => uint256) public executorToSpaceId;

  // New mapping to track which spaces a member is part of
  mapping(address => uint256[]) internal memberSpaces;

}

