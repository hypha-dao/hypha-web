// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDecayingTokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;
  
  function setDecayVotingPowerContract(
    address _decayVotingPowerContract
  ) external;

  function deployDecayingToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool isVotingToken,
    uint256 decayPercentage,
    uint256 decayInterval
  ) external returns (address);

  event TokenDeployed(
    uint256 indexed spaceId,
    address indexed tokenAddress,
    string name,
    string symbol
  );

  event VotingTokenSet(uint256 indexed spaceId, address indexed tokenAddress);

  event DecayingTokenParameters(
    address indexed tokenAddress,
    uint256 decayPercentage,
    uint256 decayInterval
  );

  event DecayVotingPowerContractUpdated(
    address indexed newDecayVotingPowerContract
  );
  
  event SpacesContractUpdated(address indexed newSpacesContract);
} 