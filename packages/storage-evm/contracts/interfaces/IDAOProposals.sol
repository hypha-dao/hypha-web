// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDAOProposals {
  struct Transaction {
    address target; // Target contract address
    uint256 value; // ETH value to send
    bytes data; // Call data
  }

  struct ProposalParams {
    uint256 spaceId;
    uint256 duration;
    Transaction[] transactions; // Multiple transactions
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
      address creator,
      Transaction[] memory transactions
    );

  function getProposalEndTime(
    uint256 _proposalId
  ) external view returns (uint256);

  // New functions to get accepted and rejected proposals by space
  function getSpaceProposals(
    uint256 _spaceId
  )
    external
    view
    returns (uint256[] memory accepted, uint256[] memory rejected);

  // New function to get executed proposals for a space
  function getExecutedProposalsBySpace(
    uint256 _spaceId
  ) external view returns (uint256[] memory);

  // New function to get all executed proposals
  function getAllExecutedProposals() external view returns (uint256[] memory);

  // New function to get voter addresses for a proposal
  function getProposalVoters(
    uint256 _proposalId
  )
    external
    view
    returns (address[] memory yesVoters, address[] memory noVoters);

  // Withdrawal functions
  function withdrawProposal(uint256 _proposalId) external;

  function isProposalWithdrawn(
    uint256 _proposalId
  ) external view returns (bool);

  function getWithdrawnProposalsBySpace(
    uint256 _spaceId
  ) external view returns (uint256[] memory);

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
  event VoteChanged(
    uint256 indexed proposalId,
    address indexed voter,
    bool previousSupport,
    bool newSupport,
    uint256 previousVotingPower,
    uint256 newVotingPower
  );
  event ProposalExecuted(
    uint256 indexed proposalId,
    bool passed,
    uint256 yesVotes,
    uint256 noVotes
  );
  event ProposalExpired(uint256 indexed proposalId);
  event ProposalRejected(
    uint256 indexed proposalId,
    uint256 yesVotes,
    uint256 noVotes
  );
  event ExecutorSet(uint256 indexed spaceId, address executor);

  // Add new event for value tracking
  event ProposalValueSet(uint256 indexed proposalId, uint256 value);

  event MinimumProposalDurationSet(uint256 indexed spaceId, uint256 duration);

  event ProposalWithdrawn(
    uint256 indexed proposalId,
    uint256 indexed spaceId,
    address withdrawnBy
  );
}
