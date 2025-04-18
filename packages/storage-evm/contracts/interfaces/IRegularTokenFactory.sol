// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegularTokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;

  function setVotingPowerContract(address _votingPowerContract) external;

  function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool isVotingToken
  ) external returns (address);
  
  event TokenDeployed(
    uint256 indexed spaceId,
    address indexed tokenAddress,
    string name,
    string symbol
  );

  event VotingTokenSet(uint256 indexed spaceId, address indexed tokenAddress);

  event VotingPowerContractUpdated(address indexed newVotingPowerContract);

  event SpacesContractUpdated(address indexed newSpacesContract);
} 