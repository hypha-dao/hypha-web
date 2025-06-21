// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDAOSpaceFactory {
  struct SpaceCreationParams {
    uint256 unity;
    uint256 quorum;
    uint256 votingPowerSource;
    uint256 exitMethod;
    uint256 joinMethod;
  }

  function initialize(address initialOwner) external;

  function setContracts(
    address _joinMethodDirectoryAddress,
    address _exitMethodDirectoryAddress,
    address _proposalManagerAddress
  ) external;

  function createSpace(
    SpaceCreationParams memory params
  ) external returns (uint256);

  function joinSpace(uint256 _spaceId) external;

  function addMember(uint256 _spaceId, address _memberAddress) external;

  //function removeMember(uint256 _spaceId, address _memberToRemove) external;

  function getSpaceMembers(
    uint256 _spaceId
  ) external view returns (address[] memory);

  function getSpaceExecutor(uint256 _spaceId) external view returns (address);

  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool);

  function isSpaceCreator(
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

  /*
  function getSpaceMemberAddresses(
    uint256 _spaceId
  ) external view returns (address[] memory);
*/
  function getSpaceMemberIds(
    uint256 _spaceId
  ) external view returns (uint256[] memory);

  function getMemberSpaces(
    address _memberAddress
  ) external view returns (uint256[] memory);

  function changeVotingMethod(
    uint256 _spaceId,
    uint256 _newVotingPowerSource,
    uint256 _newUnity,
    uint256 _newQuorum
  ) external;

  event SpaceCreated(
    uint256 indexed spaceId,
    uint256 unity,
    uint256 quorum,
    uint256 votingPowerSource,
    uint256 exitMethod,
    uint256 joinMethod,
    address indexed creator,
    address executor
  );

  event MemberJoined(uint256 indexed spaceId, address indexed memberAddress);
  //event DirectoryContractUpdated(address indexed newAddress);
  event MemberRemoved(uint256 indexed spaceId, address indexed memberAddress);

  //event TokenFactoryContractUpdated(address indexed newAddress);
  //event JoinMethodDirectoryContractUpdated(address indexed newAddress);
  //event ProposalManagerUpdated(address indexed newAddress);
  //event ExitMethodDirectoryContractUpdated(address indexed newAddress);

  event VotingMethodChanged(
    uint256 indexed spaceId,
    uint256 oldVotingPowerSource,
    uint256 newVotingPowerSource,
    uint256 oldUnity,
    uint256 newUnity,
    uint256 oldQuorum,
    uint256 newQuorum
  );
  event EntryMethodChanged(
    uint256 indexed spaceId,
    uint256 oldJoinMethod,
    uint256 newJoinMethod
  );
}
