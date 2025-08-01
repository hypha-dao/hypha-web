// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnershipTokenVotingPower {
  function initialize(address initialOwner) external;

  function setOwnershipTokenFactory(address _tokenFactory) external;

  function setSpaceFactory(address _spaceFactory) external;

  function setSpaceToken(uint256 _spaceId, address _tokenAddress) external;

  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  // Events
  event SpaceTokenSet(uint256 indexed spaceId, address indexed tokenAddress);
  event OwnershipTokenFactorySet(address indexed tokenFactory);
  event SpaceFactorySet(address indexed spaceFactory);
}
