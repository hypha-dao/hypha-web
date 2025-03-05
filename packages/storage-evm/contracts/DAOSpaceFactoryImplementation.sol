// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DAOSpaceFactoryStorage.sol';
import './interfaces/ITokenFactory.sol';
import './Executor.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExitMethodDirectory.sol';

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
    require(
      msg.sender == spaces[_spaceId].executor,
      'Only space executor can call this function'
    );
    _;
  }

  function setContracts(
    address _tokenFactoryAddress,
    address _joinMethodDirectoryAddress,
    address _exitMethodDirectoryAddress,
    address _proposalManagerAddress
  ) external onlyOwner {
    //require(_tokenFactoryAddress != address(0), "Invalid TokenFactory address");
    //require(_joinMethodDirectoryAddress != address(0), "Invalid JoinMethodDirectory address");
    //require(_exitMethodDirectoryAddress != address(0), "Invalid ExitMethodDirectory address");
    //require(_proposalManagerAddress != address(0), "Invalid ProposalManager address");

    tokenFactoryAddress = _tokenFactoryAddress;
    joinMethodDirectoryAddress = _joinMethodDirectoryAddress;
    exitMethodDirectoryAddress = _exitMethodDirectoryAddress;
    proposalManagerAddress = _proposalManagerAddress;

    emit TokenFactoryContractUpdated(_tokenFactoryAddress);
    emit JoinMethodDirectoryContractUpdated(_joinMethodDirectoryAddress);
    emit ExitMethodDirectoryContractUpdated(_exitMethodDirectoryAddress);
    emit ProposalManagerUpdated(_proposalManagerAddress);
  }

  function createSpace(
    SpaceCreationParams memory params
  ) external returns (uint256) {
    require(
      params.quorum > 0 && params.quorum <= 100,
      'Quorum must be between 1 and 100'
    );
    require(
      params.unity > 0 && params.unity <= 100,
      'Unity value must be between 1 and 100'
    );
    require(proposalManagerAddress != address(0), 'ProposalManager not set');

    if (params.createToken) {
      require(tokenFactoryAddress != address(0), 'TokenFactory not set');
      require(bytes(params.tokenName).length > 0, 'Token name cannot be empty');
      require(
        bytes(params.tokenSymbol).length > 0,
        'Token symbol cannot be empty'
      );
    }

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

    // Initialize arrays
    newSpace.tokenAddresses = new address[](0);
    address[] memory initialMembers = new address[](1);
    initialMembers[0] = msg.sender;
    newSpace.members = initialMembers;

    if (params.createToken) {
      address tokenAddress = ITokenFactory(tokenFactoryAddress).deployToken(
        spaceCounter,
        params.tokenName,
        params.tokenSymbol
      );
      newSpace.tokenAddresses.push(tokenAddress);
    }

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

  function joinSpace(uint256 _spaceId) public {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    require(
      joinMethodDirectoryAddress != address(0),
      'Directory contract not set'
    );

    Space storage space = spaces[_spaceId];

    for (uint256 i = 0; i < space.members.length; i++) {
      require(space.members[i] != msg.sender, 'Already a member');
    }

    require(
      IDirectory(joinMethodDirectoryAddress).joincheck(
        _spaceId,
        space.joinMethod,
        msg.sender
      ),
      'Join criteria not met'
    );

    space.members.push(msg.sender);

    // Check if the joining member is a space executor and add to space members if it is
    for (uint256 i = 1; i <= spaceCounter; i++) {
      if (spaces[i].executor == msg.sender) {
        SpaceMembers storage members = spaceMembers[_spaceId];
        require(!members.isSpaceMember[msg.sender], 'Already a space member');
        members.spaceMemberAddresses.push(msg.sender);
        members.isSpaceMember[msg.sender] = true;
        break;
      }
    }

    emit MemberJoined(_spaceId, msg.sender);
  }

  function removeMember(uint256 _spaceId, address _memberToRemove) public {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    require(
      exitMethodDirectoryAddress != address(0),
      'Exit directory contract not set'
    );

    Space storage space = spaces[_spaceId];

    // If exit method is 1, only executor can remove members
    if (space.exitMethod == 1) {
      require(msg.sender == space.executor, 'Only executor can remove members');
    }

    // Check if exit is allowed through exit method directory
    if (space.exitMethod != 1) {
      require(
        IExitMethodDirectory(exitMethodDirectoryAddress).exitcheck(
          _spaceId,
          space.exitMethod,
          _memberToRemove
        ),
        'Exit criteria not met'
      );
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
    require(_memberToRemove != space.creator, 'Cannot remove space creator');

    // Remove from regular members
    space.members[memberIndex] = space.members[space.members.length - 1];
    space.members.pop();

    // If member is a space member, remove from space members too
    if (members.isSpaceMember[_memberToRemove]) {
      for (uint256 i = 0; i < members.spaceMemberAddresses.length; i++) {
        if (members.spaceMemberAddresses[i] == _memberToRemove) {
          members.spaceMemberAddresses[i] = members.spaceMemberAddresses[
            members.spaceMemberAddresses.length - 1
          ];
          members.spaceMemberAddresses.pop();
          members.isSpaceMember[_memberToRemove] = false;
          break;
        }
      }
    }

    emit MemberRemoved(_spaceId, _memberToRemove);
  }

  function addTokenToSpace(uint256 _spaceId, address _tokenAddress) external {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    require(
      msg.sender == tokenFactoryAddress,
      'Only token factory can add tokens'
    );
    require(_tokenAddress != address(0), 'Token address cannot be zero');

    Space storage space = spaces[_spaceId];
    space.tokenAddresses.push(_tokenAddress);
  }

  function getSpaceMembers(
    uint256 _spaceId
  ) public view returns (address[] memory) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    return spaces[_spaceId].members;
  }

  function hasToken(
    uint256 _spaceId,
    address _tokenAddress
  ) external view returns (bool) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');

    Space storage space = spaces[_spaceId];
    for (uint256 i = 0; i < space.tokenAddresses.length; i++) {
      if (space.tokenAddresses[i] == _tokenAddress) {
        return true;
      }
    }
    return false;
  }

  function getSpaceExecutor(uint256 _spaceId) external view returns (address) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    return spaces[_spaceId].executor;
  }

  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
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
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
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
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
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

  function getSpaceMemberAddresses(
    uint256 _spaceId
  ) external view returns (address[] memory) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    return spaceMembers[_spaceId].spaceMemberAddresses;
  }

  function isSpaceMember(
    uint256 _spaceId,
    address _member
  ) external view returns (bool) {
    require(_spaceId > 0 && _spaceId <= spaceCounter, 'Invalid space ID');
    return spaceMembers[_spaceId].isSpaceMember[_member];
  }

  function getSpaceId(address _spaceAddress) external view returns (uint256) {
    uint256 spaceId = executorToSpaceId[_spaceAddress];
    require(spaceId != 0, 'Not a space address');
    return spaceId;
  }
}
