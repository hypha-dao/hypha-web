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
  // HyphaToken address - proposals targeting this contract bypass subscription checks
  address public constant hyphaTokenAddress =
    0x8b93862835C36e9689E9bb1Ab21De3982e266CD3;

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
    require(_spaceFactory != address(0), 'Invalid factory address');
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
    require(address(spaceFactory) != address(0), 'Contracts not initialized');

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
        require(isDelegate, 'Not a member or delegate');
      }
    }

    require(_duration <= MAX_VOTING_DURATION, 'Duration exceeds maximum');
    require(_transactions.length > 0, 'No transactions provided');

    for (uint i = 0; i < _transactions.length; i++) {
      require(_transactions[i].target != address(0), 'Invalid target address');
      require(_transactions[i].data.length > 0, 'Transaction data is empty');
    }

    require(
      spaceFactory.getSpaceExecutor(_spaceId) != address(0),
      'No executor for space'
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

    (, uint256 q, , , , , , , , ) = spaceFactory.getSpaceDetails(
      params.spaceId
    );

    // Determine the actual duration to use for the proposal
    uint256 actualDuration;
    if (spaceMinProposalDuration[params.spaceId] > 0 || q < 20) {
      // If min proposal duration is set or q < 20, use min duration (or 72 hours default)
      if (spaceMinProposalDuration[params.spaceId] == 0) {
        spaceMinProposalDuration[params.spaceId] = 72 hours;
      }
      actualDuration = spaceMinProposalDuration[params.spaceId];
    } else {
      // Otherwise use the input parameter duration
      actualDuration = params.duration;
    }

    // Skip subscription check if proposal targets HyphaToken (payment/investment functions)
    if (
      address(paymentTracker) != address(0) &&
      !_targetsHyphaToken(params.transactions)
    ) {
      if (!paymentTracker.isSpaceActive(params.spaceId)) {
        if (!paymentTracker.hasUsedFreeTrial(params.spaceId)) {
          paymentTracker.activateFreeTrial(params.spaceId);
        } else {
          require(false, 'Subscription inactive');
        }
      }
    }

    uint256 proposalId = _initializeProposal(
      params.spaceId,
      actualDuration,
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
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    checkProposalExpiration(_proposalId);
    require(block.timestamp >= proposal.startTime, 'Proposal not started');
    require(!proposal.expired, 'Proposal has expired');
    require(!proposal.executed, 'Proposal already executed');
    require(!proposalWithdrawn[_proposalId], 'Proposal has been withdrawn');

    // Skip subscription check if proposal targets HyphaToken (payment/investment functions)
    if (
      address(paymentTracker) != address(0) &&
      !_proposalTargetsHyphaToken(_proposalId)
    ) {
      if (paymentTracker.isSpaceActive(proposal.spaceId)) {} else {
        if (!paymentTracker.hasUsedFreeTrial(proposal.spaceId)) {
          paymentTracker.activateFreeTrial(proposal.spaceId);
        } else {
          require(false, 'Subscription inactive');
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

    require(votingPower > 0, 'No voting power');

    // Handle vote resubmission - remove previous vote if exists
    if (proposal.hasVoted[msg.sender]) {
      uint256 previousVotingPower = proposal.votingPowerAtSnapshot[msg.sender];
      bool previousSupport = _findAndRemoveVoter(_proposalId, msg.sender);

      // Subtract previous voting power from the appropriate vote count
      if (previousSupport) {
        proposal.yesVotes -= previousVotingPower;
      } else {
        proposal.noVotes -= previousVotingPower;
      }

      emit VoteChanged(
        _proposalId,
        msg.sender,
        previousSupport,
        _support,
        previousVotingPower,
        votingPower
      );
    }

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

  function _findAndRemoveVoter(
    uint256 _proposalId,
    address _voter
  ) internal returns (bool previousSupport) {
    address[] storage yesVoters = proposalYesVoters[_proposalId];
    address[] storage noVoters = proposalNoVoters[_proposalId];

    // Check and remove from yes voters
    for (uint i = 0; i < yesVoters.length; i++) {
      if (yesVoters[i] == _voter) {
        // Move the last element to this position and pop
        yesVoters[i] = yesVoters[yesVoters.length - 1];
        yesVoters.pop();
        return true; // Was a yes vote
      }
    }

    // Check and remove from no voters
    for (uint i = 0; i < noVoters.length; i++) {
      if (noVoters[i] == _voter) {
        // Move the last element to this position and pop
        noVoters[i] = noVoters[noVoters.length - 1];
        noVoters.pop();
        return false; // Was a no vote
      }
    }

    // Should never reach here if hasVoted is true
    return false;
  }

  function checkAndExecuteProposal(uint256 _proposalId) internal {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    if (proposal.executed || proposal.expired) return;

    (uint256 u, uint256 q, , , , , , , , ) = spaceFactory.getSpaceDetails(
      proposal.spaceId
    );

    uint256 totalVotesCast = proposal.yesVotes + proposal.noVotes;

    // Handle case where votes exceed snapshot (e.g., members acquired tokens after proposal creation)
    // This prevents underflow errors and treats it as "full participation"
    if (totalVotesCast >= proposal.totalVotingPowerAtSnapshot) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp < proposal.startTime + minDuration) {
        return;
      }

      // All possible votes have been cast (or exceeded) - resolve based on current votes
      if (proposal.yesVotes * 100 >= u * totalVotesCast) {
        _executeProposal(_proposalId, proposal);
      } else {
        proposal.expired = true;
        spaceRejectedProposals[proposal.spaceId].push(_proposalId);
        emit ProposalRejected(_proposalId, proposal.yesVotes, proposal.noVotes);
      }
      return;
    }

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

    // Safety check: if votes exceed or equal snapshot, no remaining voting power
    // Let normal resolution handle it (prevents underflow)
    if (totalVotesCast >= proposal.totalVotingPowerAtSnapshot) {
      return false;
    }

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
    require(executor != address(0), 'No executor for space');

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
    require(success, 'Execution failed');

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

    require(address(spaceFactory) != address(0), 'Contracts not initialized');
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
      require(isDelegate, 'Not a member or delegate');
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
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    checkAndExecuteProposal(_proposalId);

    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    if (!proposal.executed && !proposal.expired) {
      uint256 minDuration = spaceMinProposalDuration[proposal.spaceId];
      if (block.timestamp >= proposal.startTime + minDuration) {
        checkProposalExpiration(_proposalId);
      }
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
    require(_paymentTracker != address(0), 'Invalid tracker address');
    paymentTracker = ISpacePaymentTracker(_paymentTracker);
  }

  function setDelegationContract(
    address _delegationContract
  ) external onlyOwner {
    require(_delegationContract != address(0), 'Invalid delegation address');
    delegationContract = IVotingPowerDelegation(_delegationContract);
  }

  /**
   * @dev Check if a proposal targets the HyphaToken contract
   * @param _transactions Array of transactions to check
   * @return true if any transaction targets HyphaToken
   */
  function _targetsHyphaToken(
    Transaction[] calldata _transactions
  ) internal pure returns (bool) {
    for (uint i = 0; i < _transactions.length; i++) {
      if (_transactions[i].target == hyphaTokenAddress) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev Check if a proposal (by ID) targets the HyphaToken contract
   * @param _proposalId Proposal ID to check
   * @return true if any transaction targets HyphaToken
   */
  function _proposalTargetsHyphaToken(
    uint256 _proposalId
  ) internal view returns (bool) {
    ProposalCore storage proposal = proposalsCoreData[_proposalId];
    for (uint i = 0; i < proposal.transactions.length; i++) {
      if (proposal.transactions[i].target == hyphaTokenAddress) {
        return true;
      }
    }
    return false;
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
    require(address(spaceFactory) != address(0), 'Contracts not initialized');

    address executor = spaceFactory.getSpaceExecutor(_spaceId);
    require(executor != address(0), 'No executor for space');
    require(
      msg.sender == executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );

    spaceMinProposalDuration[_spaceId] = _minDuration;
    emit MinimumProposalDurationSet(_spaceId, _minDuration);
  }

  /**
   * @dev Withdraw a proposal
   * @param _proposalId Proposal ID to withdraw
   * @notice Only the proposal creator can withdraw their proposal
   * @notice Proposal cannot be withdrawn if it's already executed, expired, or withdrawn
   */
  function withdrawProposal(uint256 _proposalId) external override {
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    require(proposal.creator == msg.sender, 'Only creator can withdraw');
    require(!proposal.executed, 'Proposal already executed');
    require(!proposal.expired, 'Proposal has expired');
    require(!proposalWithdrawn[_proposalId], 'Proposal already withdrawn');

    proposalWithdrawn[_proposalId] = true;
    spaceWithdrawnProposals[proposal.spaceId].push(_proposalId);

    emit ProposalWithdrawn(_proposalId, proposal.spaceId, msg.sender);
  }

  /**
   * @dev Check if a proposal is withdrawn
   * @param _proposalId Proposal ID to check
   * @return true if the proposal is withdrawn, false otherwise
   */
  function isProposalWithdrawn(
    uint256 _proposalId
  ) external view override returns (bool) {
    return proposalWithdrawn[_proposalId];
  }

  /**
   * @dev Get all withdrawn proposals for a space
   * @param _spaceId Space ID
   * @return Array of withdrawn proposal IDs
   */
  function getWithdrawnProposalsBySpace(
    uint256 _spaceId
  ) external view override returns (uint256[] memory) {
    return spaceWithdrawnProposals[_spaceId];
  }
}
