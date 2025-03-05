// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DAOProposalsStorage.sol';
import './interfaces/IDAOProposals.sol';

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
    address _targetContract,
    bytes memory _executionData
  ) internal returns (uint256) {
    proposalCounter++;
    uint256 newProposalId = proposalCounter;

    ProposalCore storage newProposal = proposalsCoreData[newProposalId];
    newProposal.spaceId = _spaceId;
    newProposal.startTime = block.timestamp;
    newProposal.duration = _duration;
    newProposal.creator = msg.sender;
    newProposal.targetContract = _targetContract;
    newProposal.executionData = _executionData;

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
    address _targetContract,
    bytes calldata _executionData
  ) internal view {
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    require(spaceFactory.isMember(_spaceId, msg.sender), 'Not a space member');
    require(_duration >= MIN_VOTING_DURATION, 'Duration too short');
    require(_duration <= MAX_VOTING_DURATION, 'Duration too long');
    require(_targetContract != address(0), 'Invalid target contract');
    require(_executionData.length > 0, 'Execution data cannot be empty');
    require(
      spaceFactory.getSpaceExecutor(_spaceId) != address(0),
      'Executor not set for space'
    );
  }

  function _createNestedProposal(
    uint256 _parentProposalId,
    uint256 _childSpaceId,
    uint256 _duration,
    address _targetContract,
    bytes memory _executionData,
    uint256 _value
  ) internal returns (uint256) {
    uint256 childProposalId = _initializeProposal(
      _childSpaceId,
      _duration,
      _targetContract,
      _executionData
    );

    proposalValues[childProposalId] = _value;

    nestedProposals[_parentProposalId].push(childProposalId);
    parentProposal[childProposalId] = _parentProposalId;

    emit NestedProposalCreated(
      _parentProposalId,
      childProposalId,
      _childSpaceId
    );

    return childProposalId;
  }

  function _createNestedProposalsForMembers(
    uint256 _mainProposalId,
    uint256 _spaceId,
    uint256 _duration
  ) internal {
    address[] memory spaceMembers = spaceFactory.getSpaceMemberAddresses(
      _spaceId
    );

    for (uint256 i = 0; i < spaceMembers.length; i++) {
      address spaceMember = spaceMembers[i];
      uint256 memberSpaceId = spaceFactory.getSpaceId(spaceMember);

      _createNestedProposal(
        _mainProposalId,
        memberSpaceId,
        _duration,
        address(this),
        abi.encodeWithSignature('vote(uint256,bool)', _mainProposalId, true),
        0
      );
    }
  }

  function createProposal(
    ProposalParams calldata params
  ) external override returns (uint256) {
    _validateProposalParams(
      params.spaceId,
      params.duration,
      params.targetContract,
      params.executionData
    );

    uint256 mainProposalId = _initializeProposal(
      params.spaceId,
      params.duration,
      params.targetContract,
      params.executionData
    );

    proposalValues[mainProposalId] = params.value;

    _createNestedProposalsForMembers(
      mainProposalId,
      params.spaceId,
      params.duration
    );

    emit ProposalCreated(
      mainProposalId,
      params.spaceId,
      block.timestamp,
      params.duration,
      msg.sender,
      params.executionData
    );

    return mainProposalId;
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

    uint256 parentId = parentProposal[_proposalId];
    if (parentId != 0) {
      require(!proposalsCoreData[parentId].expired, 'Parent proposal expired');
      require(
        !proposalsCoreData[parentId].executed,
        'Parent proposal executed'
      );
    }

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
    IVotingPowerSource votingPowerSource = IVotingPowerSource(
      votingPowerSourceAddr
    );

    uint256 votingPower = votingPowerSource.getVotingPower(
      msg.sender,
      proposal.spaceId
    );
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

  function editProposal(
    uint256 _proposalId,
    ProposalParams calldata params
  ) external {
    require(address(spaceFactory) != address(0), 'Contracts not initialized');
    ProposalCore storage proposal = proposalsCoreData[_proposalId];

    require(msg.sender == proposal.creator, 'Only creator can edit');
    require(!proposal.expired, 'Proposal has expired');
    require(!proposal.executed, 'Proposal already executed');
    require(
      proposal.yesVotes == 0 && proposal.noVotes == 0,
      'Voting has started'
    );

    // Validate new parameters
    _validateProposalParams(
      proposal.spaceId,
      params.duration,
      params.targetContract,
      params.executionData
    );

    // Update proposal core data
    proposal.duration = params.duration;
    proposal.targetContract = params.targetContract;
    proposal.executionData = params.executionData;

    // Update nested proposals if they exist
    uint256[] storage nestedProposalIds = nestedProposals[_proposalId];
    for (uint256 i = 0; i < nestedProposalIds.length; i++) {
      uint256 childId = nestedProposalIds[i];
      ProposalCore storage childProposal = proposalsCoreData[childId];

      // Update child proposal
      childProposal.duration = params.duration;
    }
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
        bool success = IExecutor(executor).executeTransaction(
          proposal.targetContract,
          proposalValues[_proposalId],
          proposal.executionData
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
