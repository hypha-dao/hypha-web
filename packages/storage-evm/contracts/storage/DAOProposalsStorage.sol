// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

interface IDAOSpaceFactory {
  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool);

  function getSpaceDetails(
    uint256 _spaceId
  )
    external
    view
    returns (
      uint256 unity,
      uint256 quorum,
      uint256 votingPowerSource,
      address[] memory tokenAddresses,
      address[] memory members,
      uint256 exitMethod,
      uint256 joinMethod,
      uint256 createdAt,
      address creator,
      address executor
    );

  function getSpaceExecutor(uint256 _spaceId) external view returns (address);

  function getSpaceMemberAddresses(
    uint256 _spaceId
  ) external view returns (address[] memory);

  function getSpaceId(address _spaceAddress) external view returns (uint256);
}

interface IDirectory {
  function getVotingPowerSourceContract(
    uint256 _votingPowerSourceId
  ) external view returns (address);
}

interface IVotingPowerSource {
  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view returns (uint256);
}

interface IExecutor {
  function executeTransaction(
    address target,
    uint256 value,
    bytes memory data
  ) external returns (bool);
}

contract DAOProposalsStorage is Initializable {
  struct ProposalCore {
    uint256 spaceId;
    uint256 startTime;
    uint256 duration;
    uint256 yesVotes;
    uint256 noVotes;
    uint256 totalVotingPowerAtSnapshot;
    address creator;
    address targetContract;
    bytes executionData;
    bool executed;
    bool expired;
    mapping(address => bool) hasVoted;
    mapping(address => uint256) votingPowerAtSnapshot;
  }

  // Original storage variables - DO NOT MODIFY ORDER
  IDAOSpaceFactory public spaceFactory;
  IDirectory public directoryContract;
  mapping(uint256 => address) public spaceExecutors;
  mapping(uint256 => ProposalCore) public proposalsCoreData;
  uint256 public proposalCounter;
  uint256 public constant MIN_VOTING_DURATION = 1 hours;
  uint256 public constant MAX_VOTING_DURATION = 30 days;
  mapping(uint256 => uint256) public proposalValues; // proposalId => ETH value

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[48] private __gap;

  // New storage variables - Add at the end
  mapping(uint256 => address) public spaceAddresses;
}
