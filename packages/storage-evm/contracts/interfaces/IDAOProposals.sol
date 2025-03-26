// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDAOProposals {
  struct ProposalParams {
    uint256 spaceId;
    uint256 duration;
    address targetContract;
    bytes executionData;
    uint256 value;
  }

  function initialize(address initialOwner) external;

  function setContracts(address _spaceFactory, address _directory) external;

  function createProposal(
    ProposalParams calldata params
  ) external returns (uint256);

  function vote(uint256 _proposalId, bool _support) external;

  function checkProposalExpiration(uint256 _proposalId) external returns (bool);

  function hasVoted(
    uint256 _proposalId,
    address _voter
  ) external view returns (bool);

  function getProposalCore(
    uint256 _proposalId
  )
    external
    view
    returns (
      uint256 spaceId,
      uint256 startTime,
      uint256 endTime,
      bool executed,
      bool expired,
      uint256 yesVotes,
      uint256 noVotes,
      uint256 totalVotingPowerAtSnapshot,
      address creator
    );

  function getProposalEndTime(
    uint256 _proposalId
  ) external view returns (uint256);

  // Events
  event ProposalCreated(
    uint256 indexed proposalId,
    uint256 indexed spaceId,
    uint256 startTime,
    uint256 duration,
    address creator,
    bytes executionData
  );

  event ProposalEdited(
    uint256 indexed proposalId,
    uint256 indexed spaceId,
    uint256 newDuration,
    address targetContract,
    bytes executionData,
    uint256 value,
    address editor
  );

  event VoteCast(
    uint256 indexed proposalId,
    address indexed voter,
    bool support,
    uint256 votingPower
  );
  event ProposalExecuted(
    uint256 indexed proposalId,
    bool passed,
    uint256 yesVotes,
    uint256 noVotes
  );
  event ProposalExpired(uint256 indexed proposalId);
  event ExecutorSet(uint256 indexed spaceId, address executor);

  // Add new event for value tracking
  event ProposalValueSet(uint256 indexed proposalId, uint256 value);
}
