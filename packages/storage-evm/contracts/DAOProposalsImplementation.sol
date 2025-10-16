// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DAOProposalsStorage.sol';
import './interfaces/IDAOProposals.sol';
import './interfaces/IExecutor.sol';
import './interfaces/IDecayTokenVotingPower.sol';
import './interfaces/ISpacePaymentTracker.sol';
import './interfaces/IVotingPowerDelegation.sol';

contract DAOProposalsImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  DAOProposalsStorage,
  IDAOProposals
{
  error InvalidFactory();
  error InvalidDirectory();
  error NotInitialized();
  error NotMember();
  error DurationTooLong();
  error NoTransactions();
  error InvalidTarget();
  error EmptyData();
  error NoExecutor();
  error SetMinDuration();
  error SubscriptionInactive();
  error NotStarted();
  error Expired();
  error Executed();
  error Voted();
  error NoPower();
  error InvalidTracker();
  error InvalidDelegation();
  error OnlyExecutor();
  error ExecutionFailed();

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
    if (_spaceFactory == address(0)) revert InvalidFactory();
    if (_directory == address(0)) revert InvalidDirectory();

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

    (, , uint256 votingPowerSourceId, , , , , , , ) = spaceFactory
      .getSpaceDetails(_spaceId);

    address votingPowerSourceAddr = directoryContract
      .getVotingPowerSourceContract(votingPowerSourceId);
    IVotingPowerSource votingPowerSource = IVotingPowerSource(
      votingPowerSourceAddr
    );
    newProposal.totalVotingPowerAtSnapshot = votingPowerSource
      .getTotalVotingPower(_spaceId);

    return newProposalId;
  }

  function _validateProposalParams(
    uint256 _spaceId,
    uint256 _duration,
    Transaction[] calldata _transactions
  ) internal view {
    if (address(spaceFactory) == address(0)) revert NotInitialized();

    if (msg.sender != address(spaceFactory)) {
      if (!spaceFactory.isMember(_spaceId, msg.sender)) {
        bool isDelegate = false;
        if (address(delegationContract) != address(0)) {
          if (
            delegationContract.getDelegators(msg.sender, _spaceId).length > 0
          ) {
            isDelegate = true;
          }
        }
        if (!isDelegate) {
          revert NotMember();
        }
      }
    }

    if (_duration > MAX_VOTING_DURATION) revert DurationTooLong();
    if (_transactions.length == 0) revert NoTransactions();

    for (uint i = 0; i < _transactions.length; i++) {
      if (_transactions[i].target == address(0)) revert InvalidTarget();
      if (_transactions[i].data.length == 0) revert EmptyData();
    }

    if (spaceFactory.getSpaceExecutor(_spaceId) == address(0))
      revert NoExecutor();
  }

  function createProposal(
    ProposalParams calldata params
  ) external override returns (uint256) {
    _validateProposalParams(
      params.spaceId,
      params.duration,
      params.transactions
    );

    (uint256 u, uint256 q, , , , , , , , ) = spaceFactory.getSpaceDetails(
      params.spaceId
    );

    if (q < 20) {
      if (spaceMinProposalDuration[params.spaceId] == 0) {
        spaceMinProposalDuration[params.spaceId] = 72 hours;
      }
    }

    if (address(paymentTracker) != address(0)) {
      if (!paymentTracker.isSpaceActive(params.spaceId)) {
        if (!paymentTracker.hasUsedFreeTrial(params.spaceId)) {
          paymentTracker.activateFreeTrial(params.spaceId);
        } else {
          revert SubscriptionInactive();
        }
      }
    }

    uint256 proposalId = _initializeProposal(
      params.spaceId,
      params.duration,
      params.transactions
    );

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
    if (address(spaceFactory) == address(0)) revert NotInitialized();
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    checkProposalExpiration(_proposalId);
    if (block.timestamp < proposal.startTime) revert NotStarted();
    if (proposal.expired) revert Expired();
    if (proposal.executed) revert Executed();
    if (proposal.hasVoted[msg.sender]) revert Voted();
    if (address(paymentTracker) != address(0)) {
      if (paymentTracker.isSpaceActive(proposal.spaceId)) {} else {
        if (!paymentTracker.hasUsedFreeTrial(proposal.spaceId)) {
          paymentTracker.activateFreeTrial(proposal.spaceId);
        } else {
          revert SubscriptionInactive();
        }
      }
    }

    (, , uint256 votingPowerSourceId, , , , , , , ) = spaceFactory
      .getSpaceDetails(proposal.spaceId);

    address votingPowerSourceAddr = directoryContract
      .getVotingPowerSourceContract(votingPowerSourceId);

    uint256 votingPower;

    if (votingPowerSourceId == 3) {
      IDecayTokenVotingPower decayVotingPowerSource = IDecayTokenVotingPower(
        votingPowerSourceAddr
      );
      votingPower = decayVotingPowerSource.applyDecayAndGetVotingPower(
        msg.sender,
        proposal.spaceId
      );
    } else {
      IVotingPowerSource votingPowerSource = IVotingPowerSource(
        votingPowerSourceAddr
      );
      votingPower = votingPowerSource.getVotingPower(
        msg.sender,
        proposal.spaceId
      );
    }

    if (votingPower == 0) revert NoPower();

    proposal.hasVoted[msg.sender] = true;
    proposal.votingPowerAtSnapshot[msg.sender] = votingPower;

    if (_support) {
      proposal.yesVotes += votingPower;
      proposalYesVoters[_proposalId].push(msg.sender);
    } else {
      proposal.noVotes += votingPower;
      proposalNoVoters[_proposalId].push(msg.sender);
    }

    emit VoteCast(_proposalId, msg.sender, _support, votingPower);

    checkAndExecuteProposal(_proposalId);
  }

  function checkAndExecuteProposal(uint256 _proposalId) internal {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    if (proposal.executed || proposal.expired) return;

    (uint256 u, uint256 q, , , , , , , , ) = spaceFactory.getSpaceDetails(
      proposal.spaceId
    );

    uint256 totalVotesCast = proposal.yesVotes + proposal.noVotes;
    uint256 requiredQuorum = (q * proposal.totalVotingPowerAtSnapshot + 99) /
      100;
    bool quorumReached = totalVotesCast >= requiredQuorum;

    if (quorumReached && _shouldRejectEarly(_proposalId, u)) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp < proposal.startTime + minDuration) {
        return;
      }
      proposal.expired = true;
      spaceRejectedProposals[proposal.spaceId].push(_proposalId);
      emit ProposalRejected(_proposalId, proposal.yesVotes, proposal.noVotes);
      return;
    }

    if (!quorumReached) {
      return;
    }

    if (proposal.yesVotes * 100 >= u * totalVotesCast) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp < proposal.startTime + minDuration) {
        return;
      }
      _executeProposal(_proposalId, proposal);
    } else if (proposal.noVotes * 100 >= u * totalVotesCast) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp < proposal.startTime + minDuration) {
        return;
      }
      proposal.expired = true;
      spaceRejectedProposals[proposal.spaceId].push(_proposalId);
      emit ProposalRejected(_proposalId, proposal.yesVotes, proposal.noVotes);
    } else if (q == 100) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp < proposal.startTime + minDuration) {
        return;
      }
      proposal.expired = true;
      spaceRejectedProposals[proposal.spaceId].push(_proposalId);
      emit ProposalRejected(_proposalId, proposal.yesVotes, proposal.noVotes);
    }
  }

  function _shouldRejectEarly(
    uint256 _proposalId,
    uint256 u
  ) internal view returns (bool) {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    uint256 totalVotesCast = proposal.yesVotes + proposal.noVotes;
    uint256 remainingVotingPower = proposal.totalVotingPowerAtSnapshot -
      totalVotesCast;
    uint256 maxPossibleYesVotes = proposal.yesVotes + remainingVotingPower;
    uint256 maxPossibleTotalVotes = totalVotesCast + remainingVotingPower;
    return maxPossibleYesVotes * 100 < u * maxPossibleTotalVotes;
  }

  function _executeProposal(
    uint256 _proposalId,
    ProposalCore storage proposal
  ) internal {
    proposal.executed = true;
    spaceExecutedProposals[proposal.spaceId].push(_proposalId);
    allExecutedProposals.push(_proposalId);
    spaceAcceptedProposals[proposal.spaceId].push(_proposalId);

    address executor = spaceFactory.getSpaceExecutor(proposal.spaceId);
    if (executor == address(0)) revert NoExecutor();

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

    bool success = IExecutor(executor).executeTransactions(execTransactions);
    if (!success) revert ExecutionFailed();

    emit ProposalExecuted(
      _proposalId,
      true,
      proposal.yesVotes,
      proposal.noVotes
    );
  }

  function checkProposalExpiration(
    uint256 _proposalId
  ) public override returns (bool) {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    if (address(spaceFactory) == address(0)) revert NotInitialized();
    if (!spaceFactory.isMember(proposal.spaceId, msg.sender)) {
      bool isDelegate = false;
      if (address(delegationContract) != address(0)) {
        if (
          delegationContract
            .getDelegators(msg.sender, proposal.spaceId)
            .length > 0
        ) {
          isDelegate = true;
        }
      }
      if (!isDelegate) {
        revert NotMember();
      }
    }

    if (
      !proposal.expired && block.timestamp > getProposalEndTime(_proposalId)
    ) {
      proposal.expired = true;

      if (!proposal.executed) {
        spaceRejectedProposals[proposal.spaceId].push(_proposalId);
      }

      emit ProposalExpired(_proposalId);
      return true;
    }

    return proposal.expired;
  }

  function triggerExecutionCheck(uint256 _proposalId) external {
    if (address(spaceFactory) == address(0)) revert NotInitialized();
    checkAndExecuteProposal(_proposalId);

    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    if (!proposal.executed && !proposal.expired) {
      checkProposalExpiration(_proposalId);
    }
  }

  function getSpaceProposals(
    uint256 _spaceId
  )
    external
    view
    override
    returns (uint256[] memory accepted, uint256[] memory rejected)
  {
    return (spaceAcceptedProposals[_spaceId], spaceRejectedProposals[_spaceId]);
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
      address creator,
      Transaction[] memory transactions
    )
  {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    // Create a memory array to hold the transactions
    Transaction[] memory txns = new Transaction[](proposal.transactions.length);

    // Copy the transactions from storage to memory
    for (uint i = 0; i < proposal.transactions.length; i++) {
      txns[i] = proposal.transactions[i];
    }

    return (
      proposal.spaceId,
      proposal.startTime,
      proposal.startTime + proposal.duration,
      proposal.executed,
      proposal.expired,
      proposal.yesVotes,
      proposal.noVotes,
      proposal.totalVotingPowerAtSnapshot,
      proposal.creator,
      txns
    );
  }

  function setPaymentTracker(address _paymentTracker) external onlyOwner {
    if (_paymentTracker == address(0)) revert InvalidTracker();
    paymentTracker = ISpacePaymentTracker(_paymentTracker);
  }

  function setDelegationContract(
    address _delegationContract
  ) external onlyOwner {
    if (_delegationContract == address(0)) revert InvalidDelegation();
    delegationContract = IVotingPowerDelegation(_delegationContract);
  }

  function getExecutedProposalsBySpace(
    uint256 _spaceId
  ) external view override returns (uint256[] memory) {
    return spaceExecutedProposals[_spaceId];
  }

  function getAllExecutedProposals()
    external
    view
    override
    returns (uint256[] memory)
  {
    return allExecutedProposals;
  }

  function getProposalVoters(
    uint256 _proposalId
  )
    external
    view
    returns (address[] memory yesVoters, address[] memory noVoters)
  {
    return (proposalYesVoters[_proposalId], proposalNoVoters[_proposalId]);
  }

  function setMinimumProposalDuration(
    uint256 _spaceId,
    uint256 _minDuration
  ) external {
    if (address(spaceFactory) == address(0)) revert NotInitialized();

    address executor = spaceFactory.getSpaceExecutor(_spaceId);
    if (executor == address(0)) revert NoExecutor();
    if (msg.sender != executor) revert OnlyExecutor();

    spaceMinProposalDuration[_spaceId] = _minDuration;
    emit MinimumProposalDurationSet(_spaceId, _minDuration);
  }
}
