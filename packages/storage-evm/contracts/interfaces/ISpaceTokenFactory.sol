// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../SpaceToken.sol';
import '../SpaceTokenFactory.sol';

interface ISpaceTokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;

  function setVotingPowerContract(address _votingPowerContract) external;

  function deployToken(
    uint256 spaceId,
    SpaceToken.TokenConfig memory base,
    SpaceTokenFactory.FeatureConfig memory features
  ) external returns (address);

  function getSpaceToken(
    uint256 spaceId
  ) external view returns (address[] memory);

  event TokenDeployed(
    uint256 indexed spaceId,
    address indexed tokenAddress,
    string name,
    string symbol
  );

  event VotingPowerContractUpdated(address indexed newVotingPowerContract);

  event SpacesContractUpdated(address indexed newSpacesContract);
}
