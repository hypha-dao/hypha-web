// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DAOProposalsStorage.sol';
import './interfaces/IDAOProposals.sol';
import './interfaces/IExecutor.sol';
import './interfaces/IDecayTokenVotingPower.sol';

contract DAOProposalsImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  DAOProposalsStorage,
  IDAOProposals
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    proposalCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function setContracts(
    address _spaceFactory,
    address _directory
  ) external override onlyOwner {
    require(_spaceFactory != address(0), 'Invalid space factory address');
    require(_directory != address(0), 'Invalid directory address');

    spaceFactory = IDAOSpaceFactory(_spaceFactory);
    directoryContract = IDirectory(_directory);
  }

  function _initializeProposal(
    uint256 _spaceId,
    uint256 _duration,
    Transaction[] calldata _transactions
  ) internal returns (uint256) {
    proposalCounter++;
    uint256 newProposalId = proposalCounter;

    ProposalCore storage newProposal = proposalsCoreData[newProposalId];
    newProposal.spaceId = _spaceId;
    newProposal.startTime = block.timestamp;
    newProposal.duration = _duration;
    newProposal.creator = msg.sender;

    // Store the transactions in the proposal
    for (uint i = 0; i < _transactions.length; i++) {
      newProposal.transactions.push(_transactions[i]);
    }

    (
      ,
      ,
      // unity
      // quorum
      uint256 votingPowerSourceId, // tokenAddresses // members // exitMethod // joinMethod // createdAt // creator // executor
      ,
      ,
      ,
      ,
      ,
      ,

    ) = spaceFactory.getSpaceDetails(_spaceId);

    address votingPowerSourceAddr = directoryContract
      .getVotingPowerSourceContract(votingPowerSourceId);
    IVotingPowerSource votingPowerSource = IVotingPowerSource(
      votingPowerSourceAddr
    );
    newProposal.totalVotingPowerAtSnapshot = votingPowerSource
      .getTotalVotingPower(_spaceId);

    return newProposalId;
  }

  // Helper function to validate proposal parameters
  function _validateProposalParams(
    uint256 _spaceId,
    uint256 _duration,
    Transaction[] calldata _transactions
  ) internal view {
    require(address(spaceFactory) != address(0), 'Contracts not initialized');

    // Allow space factory to create proposals regardless of membership
    // This is needed for join requests with join method 2
    if (msg.sender != address(spaceFactory)) {
      require(
        spaceFactory.isMember(_spaceId, msg.sender),
        'Not a space member'
      );
    }

    //require(_duration >= MIN_VOTING_DURATION, 'Duration too short');
    require(_duration <= MAX_VOTING_DURATION, 'Duration too long');
    require(_transactions.length > 0, 'No transactions provided');

    // Validate each transaction
    for (uint i = 0; i < _transactions.length; i++) {
      require(_transactions[i].target != address(0), 'Invalid target contract');
      require(
        _transactions[i].data.length > 0,
        'Execution data cannot be empty'
      );
    }

    require(
      spaceFactory.getSpaceExecutor(_spaceId) != address(0),
      'Executor not set for space'
    );
  }

  function createProposal(
    ProposalParams calldata params
  ) external override returns (uint256) {
    _validateProposalParams(
      params.spaceId,
      params.duration,
      params.transactions
    );

    uint256 proposalId = _initializeProposal(
      params.spaceId,
      params.duration,
      params.transactions
    );

    // We can adapt the event to store relevant information about transactions
    // For backward compatibility, we can use the first transaction's data in the event
    emit ProposalCreated(
      proposalId,
      params.spaceId,
      block.timestamp,
      params.duration,
      msg.sender,
      params.transactions.length > 0 ? params.transactions[0].data : bytes('')
    );

    return proposalId;
  }

  function getProposalEndTime(
    uint256 _proposalId
  ) public view override returns (uint256) {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    return proposal.startTime + proposal.duration;
  }

  function vote(uint256 _proposalId, bool _support) external override {
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    checkProposalExpiration(_proposalId);
    require(block.timestamp >= proposal.startTime, 'Voting not started');
    require(!proposal.expired, 'Proposal has expired');
    require(!proposal.executed, 'Proposal already executed');
    require(!proposal.hasVoted[msg.sender], 'Already voted');
    require(
      spaceFactory.isMember(proposal.spaceId, msg.sender),
      'Not a space member'
    );

    (
      ,
      ,
      // name
      // unity
      uint256 votingPowerSourceId, // tokenAddresses // members // exitMethod // joinMethod // createdAt // creator // executor
      ,
      ,
      ,
      ,
      ,
      ,

    ) = spaceFactory.getSpaceDetails(proposal.spaceId);

    address votingPowerSourceAddr = directoryContract
      .getVotingPowerSourceContract(votingPowerSourceId);

    uint256 votingPower;

    // Check if this is a decaying token voting power source (ID 2)
    if (votingPowerSourceId == 3) {
      // For decaying tokens, apply decay before calculating voting power
      IDecayTokenVotingPower decayVotingPowerSource = IDecayTokenVotingPower(
        votingPowerSourceAddr
      );
      votingPower = decayVotingPowerSource.applyDecayAndGetVotingPower(
        msg.sender,
        proposal.spaceId
      );
    } else {
      // For regular voting power sources
      IVotingPowerSource votingPowerSource = IVotingPowerSource(
        votingPowerSourceAddr
      );
      votingPower = votingPowerSource.getVotingPower(
        msg.sender,
        proposal.spaceId
      );
    }

    require(votingPower > 0, 'No voting power');

    proposal.hasVoted[msg.sender] = true;
    proposal.votingPowerAtSnapshot[msg.sender] = votingPower;

    if (_support) {
      proposal.yesVotes += votingPower;
    } else {
      proposal.noVotes += votingPower;
    }

    emit VoteCast(_proposalId, msg.sender, _support, votingPower);

    checkAndExecuteProposal(_proposalId);
  }

  function checkAndExecuteProposal(uint256 _proposalId) internal {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    if (proposal.executed || proposal.expired) return;

    (
      ,
      // name
      uint256 unityThreshold,
      uint256 quorumThreshold, // votingPowerSource // tokenAddresses // members // exitMethod // joinMethod // createdAt // executor
      ,
      ,
      ,
      ,
      ,
      ,

    ) = spaceFactory.getSpaceDetails(proposal.spaceId);

    uint256 quorumReached = (proposal.yesVotes * 100) /
      proposal.totalVotingPowerAtSnapshot;
    if (quorumReached < quorumThreshold) return;

    uint256 totalVotesCast = proposal.yesVotes + proposal.noVotes;
    if (totalVotesCast > 0) {
      uint256 yesPercentage = (proposal.yesVotes * 100) / totalVotesCast;
      if (yesPercentage >= unityThreshold) {
        proposal.executed = true;

        address executor = spaceFactory.getSpaceExecutor(proposal.spaceId);

        // Convert proposal transactions to Executor.Transaction format
        IExecutor.Transaction[]
          memory execTransactions = new IExecutor.Transaction[](
            proposal.transactions.length
          );
        for (uint i = 0; i < proposal.transactions.length; i++) {
          execTransactions[i] = IExecutor.Transaction({
            target: proposal.transactions[i].target,
            value: proposal.transactions[i].value,
            data: proposal.transactions[i].data
          });
        }

        // Execute all transactions
        bool success = IExecutor(executor).executeTransactions(
          execTransactions
        );
        require(success, 'Proposal execution failed');

        emit ProposalExecuted(
          _proposalId,
          true,
          proposal.yesVotes,
          proposal.noVotes
        );
      }
    }
  }

  function checkProposalExpiration(
    uint256 _proposalId
  ) public override returns (bool) {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    if (
      !proposal.expired && block.timestamp > getProposalEndTime(_proposalId)
    ) {
      proposal.expired = true;
      emit ProposalExpired(_proposalId);
      return true;
    }

    return proposal.expired;
  }

  function hasVoted(
    uint256 _proposalId,
    address _voter
  ) external view override returns (bool) {
    return proposalsCoreData[_proposalId].hasVoted[_voter];
  }

  function getProposalCore(
    uint256 _proposalId
  )
    external
    view
    override
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
    )
  {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    return (
      proposal.spaceId,
      proposal.startTime,
      proposal.startTime + proposal.duration,
      proposal.executed,
      proposal.expired,
      proposal.yesVotes,
      proposal.noVotes,
      proposal.totalVotingPowerAtSnapshot,
      proposal.creator
    );
  }
}
