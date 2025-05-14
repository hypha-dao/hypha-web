// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IDAOProposals.sol';
import '../interfaces/IExecutor.sol';
import '../interfaces/ISpacePaymentTracker.sol';

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

contract DAOProposalsStorage is Initializable {
  uint256 internal constant MAX_VOTING_DURATION = 30 days;

  IDAOSpaceFactory internal spaceFactory;
  IDirectory internal directoryContract;

  uint256 public proposalCounter;

  // Update ProposalCore to store multiple transactions
  struct ProposalCore {
    uint256 spaceId;
    uint256 startTime;
    uint256 duration;
    bool executed;
    bool expired;
    uint256 yesVotes;
    uint256 noVotes;
    uint256 totalVotingPowerAtSnapshot;
    address creator;
    mapping(address => bool) hasVoted;
    mapping(address => uint256) votingPowerAtSnapshot;
    // New field to store multiple transactions
    IDAOProposals.Transaction[] transactions;
  }

  mapping(uint256 => ProposalCore) internal proposalsCoreData;
  // This can be removed if all values are stored in the transactions
  mapping(uint256 => uint256) internal proposalValues;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[48] private __gap;

  // New storage variables - Add at the end
  mapping(uint256 => address) public spaceAddresses;

  // Track spaces that have activated their free trial
  mapping(uint256 => bool) public spaceTrialActivated;

  ISpacePaymentTracker public paymentTracker;

  // New storage variable to track executed proposals by space
  mapping(uint256 => uint256[]) internal spaceExecutedProposals;

  // New storage variable to track all executed proposals
  uint256[] internal allExecutedProposals;
}
