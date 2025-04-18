// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegularTokenVotingPower {
  function initialize(address initialOwner) external;

  function setTokenFactory(address _tokenFactory) external;

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
  event TokenFactorySet(address indexed tokenFactory);
}
