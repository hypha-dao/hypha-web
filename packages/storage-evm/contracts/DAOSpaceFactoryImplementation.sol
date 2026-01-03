// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DAOSpaceFactoryStorage.sol';
import './Executor.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExitMethodDirectory.sol';
import './interfaces/IDAOProposals.sol';

contract DAOSpaceFactoryImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  DAOSpaceFactoryStorage,
  IDAOSpaceFactory
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    spaceCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  modifier onlySpaceExecutor(uint256 _spaceId) {
    require(msg.sender == spaces[_spaceId].executor, 'Not executor');
    _;
  }

  // Keep this variable for storage layout compatibility with previous versions
  // @deprecated - Use proposalManagerAddress instead
  IDAOProposals public proposalsContract;

  function setContracts(
    address _joinMethodDirectoryAddress,
    address _exitMethodDirectoryAddress,
    address _proposalManagerAddress
  ) external onlyOwner {
    joinMethodDirectoryAddress = _joinMethodDirectoryAddress;
    exitMethodDirectoryAddress = _exitMethodDirectoryAddress;
    proposalManagerAddress = _proposalManagerAddress;
  }

  function createSpace(
    SpaceCreationParams memory params
  ) external returns (uint256) {
    // Common parameter validation
    require(params.quorum >= 0 && params.quorum <= 100, 'Invalid quorum range');
    require(params.unity >= 0 && params.unity <= 100, 'Invalid unity range');
    require(
      !(params.quorum == 0 && params.unity == 0),
      'Both quorum and unity cannot be zero'
    );
    require(params.access <= 3, 'Invalid access value');
    require(params.discoverability <= 3, 'Invalid discoverability value');

    spaceCounter++;

    Executor executor = new Executor(proposalManagerAddress);
    executorToSpaceId[address(executor)] = spaceCounter;

    Space storage newSpace = spaces[spaceCounter];
    newSpace.unity = params.unity;
    newSpace.quorum = params.quorum;
    newSpace.votingPowerSource = params.votingPowerSource;
    newSpace.exitMethod = params.exitMethod;
    newSpace.joinMethod = params.joinMethod;
    newSpace.createdAt = block.timestamp;
    newSpace.creator = msg.sender;
    newSpace.executor = address(executor);

    // Set visibility settings
    spaceAccess[spaceCounter] = params.access;
    spaceDiscoverability[spaceCounter] = params.discoverability;

    // Initialize arrays
    newSpace.tokenAddresses = new address[](0);
    address[] memory initialMembers = new address[](1);
    initialMembers[0] = msg.sender;
    newSpace.members = initialMembers;

    // Add this space to the creator's list of spaces
    memberSpaces[msg.sender].push(spaceCounter);

    emit SpaceCreated(
      spaceCounter,
      params.unity,
      params.quorum,
      params.votingPowerSource,
      params.exitMethod,
      params.joinMethod,
      msg.sender,
      address(executor)
    );

    return spaceCounter;
  }

  function joinSpace(uint256 _spaceId) public returns (uint256) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'isp');
    //require(joinMethodDirectoryAddress != address(0), 'Dir not set');

    Space storage space = spaces[_spaceId];

    for (uint256 i = 0; i < space.members.length; i++) {
      require(space.members[i] != msg.sender, 'member');
    }
    //add this as a separate contract
    if (space.joinMethod == 2) {
      // If join method is 2, create a proposal to add the member
      require(proposalManagerAddress != address(0), 'Proposal manager not st');

      // Check if the member has an active invite proposal or created one within 24 hours
      require(
        memberActiveInviteProposal[_spaceId][msg.sender] == 0 ||
          block.timestamp >=
          memberLastInviteTime[_spaceId][msg.sender] + 48 hours,
        'Active proposal exists or must wait 48h between invites'
      );

      // Encode the function call data for addMember
      bytes memory executionData = abi.encodeWithSelector(
        this.addMember.selector,
        _spaceId,
        msg.sender
      );

      // Create proposal params
      IDAOProposals.Transaction[]
        memory transactions = new IDAOProposals.Transaction[](1);
      transactions[0] = IDAOProposals.Transaction({
        target: address(this),
        value: 0,
        data: executionData
      });

      IDAOProposals.ProposalParams memory params = IDAOProposals
        .ProposalParams({
          spaceId: _spaceId,
          duration: 172800, // 2 day
          transactions: transactions
        });

      // Create the proposal using proposalManagerAddress
      uint256 proposalId = IDAOProposals(proposalManagerAddress).createProposal(
        params
      );

      // Track the invite proposal
      memberLastInviteTime[_spaceId][msg.sender] = block.timestamp;
      memberActiveInviteProposal[_spaceId][msg.sender] = proposalId;

      //emit JoinRequestedWithProposal(_spaceId, msg.sender, proposalId);
      return proposalId;
    } else {
      require(
        IDirectory(joinMethodDirectoryAddress).joincheck(
          _spaceId,
          space.joinMethod,
          msg.sender
        ),
        'Join criteria not met'
      );

      addMemberInternal(_spaceId, msg.sender);
      return type(uint256).max;
    }
  }

  function addMember(uint256 _spaceId, address _memberAddress) external {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');

    // Allow either the space executor or contract owner to add members
    require(
      msg.sender == spaces[_spaceId].executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );

    Space storage space = spaces[_spaceId];

    for (uint256 i = 0; i < space.members.length; i++) {
      require(space.members[i] != _memberAddress, 'Already a member');
    }

    addMemberInternal(_spaceId, _memberAddress);
  }

  function addMemberInternal(
    uint256 _spaceId,
    address _memberAddress
  ) internal {
    Space storage space = spaces[_spaceId];

    // Add member to the space
    space.members.push(_memberAddress);

    // Add this space to the member's list of spaces
    memberSpaces[_memberAddress].push(_spaceId);

    // Check if the joining member is a space executor and add to space members if it is
    for (uint256 i = 1; i <= spaceCounter; i++) {
      if (spaces[i].executor == _memberAddress) {
        SpaceMembers storage members = spaceMembers[_spaceId];
        require(
          !members.isSpaceMember[_memberAddress],
          'Already a space member'
        );
        members.spaceMemberAddresses.push(_memberAddress);
        members.isSpaceMember[_memberAddress] = true;
        break;
      }
    }

    emit MemberJoined(_spaceId, _memberAddress);
  }

  function removeMember(uint256 _spaceId, address _memberToRemove) public {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    require(
      exitMethodDirectoryAddress != address(0),
      'Exit directory contract not set'
    );

    Space storage space = spaces[_spaceId];

    // Allow contract owner to remove members regardless of exit method
    bool isOwner = msg.sender == owner();
    // Allow member to remove themselves
    bool isSelfRemoval = msg.sender == _memberToRemove;

    // If not owner and not self-removal, check exit method authorization
    if (!isOwner && !isSelfRemoval) {
      // If exit method is 1, only executor can remove members
      if (space.exitMethod == 1) {
        require(
          msg.sender == space.executor,
          'Only executor can remove members'
        );
      }

      // Check if exit is allowed through exit method directory
      if (space.exitMethod != 1) {
        require(
          IExitMethodDirectory(exitMethodDirectoryAddress).exitcheck(
            _spaceId,
            space.exitMethod,
            _memberToRemove
          ),
          'Exit criteria is not met'
        );
      }
    }

    SpaceMembers storage members = spaceMembers[_spaceId];
    bool found = false;
    uint256 memberIndex;

    // Find member in regular members
    for (uint256 i = 0; i < space.members.length; i++) {
      if (space.members[i] == _memberToRemove) {
        found = true;
        memberIndex = i;
        break;
      }
    }

    require(found, 'Member not found');
    //require(_memberToRemove != space.creator, 'Cannot remove space creator');

    // Remove from regular members array
    space.members[memberIndex] = space.members[space.members.length - 1];
    space.members.pop();

    emit MemberRemoved(_spaceId, _memberToRemove);
  }

  function getSpaceMembers(
    uint256 _spaceId
  ) public view returns (address[] memory) {
    return spaces[_spaceId].members;
  }

  /*
  function hasToken(
    uint256 _spaceId,
    address _tokenAddress
  ) external view returns (bool) {
    // This function is kept for backward compatibility
    // But since tokens are now tied directly to spaces via their constructors,
    // we need to validate that the token's spaceId matches this space
    try SpaceToken(_tokenAddress).spaceId() returns (uint256 tokenSpaceId) {
      return tokenSpaceId == _spaceId;
    } catch {
      return false;
    }
  }
  */

  function getSpaceExecutor(uint256 _spaceId) external view returns (address) {
    return spaces[_spaceId].executor;
  }

  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool) {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid spc ID');
    Space storage space = spaces[_spaceId];

    for (uint256 i = 0; i < space.members.length; i++) {
      if (space.members[i] == _userAddress) {
        return true;
      }
    }
    return false;
  }

  function isSpaceCreator(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool) {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid spc ID');
    return spaces[_spaceId].creator == _userAddress;
  }

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
    )
  {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid spc ID');
    Space storage space = spaces[_spaceId];

    return (
      space.unity,
      space.quorum,
      space.votingPowerSource,
      space.tokenAddresses,
      space.members,
      space.exitMethod,
      space.joinMethod,
      space.createdAt,
      space.creator,
      space.executor
    );
  }

  /*
  function getSpaceMemberAddresses(
    uint256 _spaceId
  ) external view returns (address[] memory) {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid spc ID');
    return spaceMembers[_spaceId].spaceMemberAddresses;
  }
*/
  function getSpaceMemberIds(
    uint256 _spaceId
  ) external view returns (uint256[] memory) {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');

    SpaceMembers storage members = spaceMembers[_spaceId];
    uint256[] memory memberSpaceIds = new uint256[](
      members.spaceMemberAddresses.length
    );

    for (uint256 i = 0; i < members.spaceMemberAddresses.length; i++) {
      memberSpaceIds[i] = executorToSpaceId[members.spaceMemberAddresses[i]];
    }

    return memberSpaceIds;
  }

  function isSpaceMember(
    uint256 _spaceId,
    address _member
  ) external view returns (bool) {
    //require(_spaceId > 0 && _spaceId <= spaceCounter, 'InvspcID');
    return spaceMembers[_spaceId].isSpaceMember[_member];
  }

  // New function to change voting power source method
  function changeVotingMethod(
    uint256 _spaceId,
    uint256 _newVotingPowerSource,
    uint256 _newUnity,
    uint256 _newQuorum
  ) external {
    require(
      msg.sender == spaces[_spaceId].executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );
    require(_newVotingPowerSource > 0, 'Invalid voting power source');
    require(_newQuorum >= 0 && _newQuorum <= 100, 'Invalid quorum range');
    require(_newUnity >= 0 && _newUnity <= 100, 'Invalid unity range');
    require(
      !(_newQuorum == 0 && _newUnity == 0),
      'Both quorum and unity cannot be zero'
    );

    Space storage space = spaces[_spaceId];
    uint256 oldVotingPowerSource = space.votingPowerSource;
    uint256 oldUnity = space.unity;
    uint256 oldQuorum = space.quorum;

    space.votingPowerSource = _newVotingPowerSource;
    space.unity = _newUnity;
    space.quorum = _newQuorum;

    emit VotingMethodChanged(
      _spaceId,
      oldVotingPowerSource,
      _newVotingPowerSource,
      oldUnity,
      _newUnity,
      oldQuorum,
      _newQuorum
    );
  }

  // New function to change entry method
  function changeEntryMethod(
    uint256 _spaceId,
    uint256 _newJoinMethod
  ) external onlySpaceExecutor(_spaceId) {
    require(_newJoinMethod >= 0, 'Invalid join method');

    Space storage space = spaces[_spaceId];
    uint256 oldJoinMethod = space.joinMethod;
    space.joinMethod = _newJoinMethod;

    emit EntryMethodChanged(_spaceId, oldJoinMethod, _newJoinMethod);
  }

  // New function to get all spaces a member is part of
  function getMemberSpaces(
    address _memberAddress
  ) external view returns (uint256[] memory) {
    return memberSpaces[_memberAddress];
  }

  // View function to check if a member has an active invite proposal for a space
  function getInviteInfo(
    uint256 _spaceId,
    address _memberAddress
  ) external view returns (uint256 lastInviteTime, bool hasActiveProposal) {
    uint256 activeProposalId = memberActiveInviteProposal[_spaceId][
      _memberAddress
    ];
    uint256 lastInvite = memberLastInviteTime[_spaceId][_memberAddress];

    return (lastInvite, activeProposalId != 0);
  }

  // Set space access level (0 = Public, 1 = Network, 2 = Org, 3 = Space)
  function setSpaceAccess(uint256 _spaceId, uint256 _access) external {
    require(
      msg.sender == spaces[_spaceId].executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );
    require(_access <= 3, 'Invalid access value');

    uint256 oldAccess = spaceAccess[_spaceId];
    spaceAccess[_spaceId] = _access;

    emit SpaceAccessChanged(_spaceId, oldAccess, _access);
  }

  // Set space discoverability level (0 = Public, 1 = Network, 2 = Org, 3 = Space)
  function setSpaceDiscoverability(
    uint256 _spaceId,
    uint256 _discoverability
  ) external {
    require(
      msg.sender == spaces[_spaceId].executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );
    require(_discoverability <= 3, 'Invalid discoverability value');

    uint256 oldDiscoverability = spaceDiscoverability[_spaceId];
    spaceDiscoverability[_spaceId] = _discoverability;

    emit SpaceDiscoverabilityChanged(
      _spaceId,
      oldDiscoverability,
      _discoverability
    );
  }

  // Get space visibility settings
  function getSpaceVisibility(
    uint256 _spaceId
  ) external view returns (SpaceVisibility memory) {
    return
      SpaceVisibility({
        discoverability: spaceDiscoverability[_spaceId],
        access: spaceAccess[_spaceId]
      });
  }
}
