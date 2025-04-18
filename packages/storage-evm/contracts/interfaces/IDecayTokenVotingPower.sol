// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDecayTokenVotingPower {
  function initialize(address initialOwner) external;

  function setDecayTokenFactory(address _decayTokenFactory) external;

  function setSpaceToken(uint256 _spaceId, address _tokenAddress) external;

  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  /**
   * @dev Apply decay to a user's balance and return the updated voting power
   * @param _user The address to apply decay and check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The updated voting power after applying decay
   */
  function applyDecayAndGetVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external returns (uint256);

  // Events
  event SpaceTokenSet(uint256 indexed spaceId, address indexed tokenAddress);
  event DecayTokenFactorySet(address indexed decayTokenFactory);
}
