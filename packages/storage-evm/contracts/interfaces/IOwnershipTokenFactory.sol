// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnershipTokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;

  function setVotingPowerContract(address _votingPowerContract) external;

  function deployOwnershipToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 priceInUSD,
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist
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

  event VotingTokenSet(uint256 indexed spaceId, address indexed tokenAddress);

  event VotingPowerContractUpdated(address indexed newVotingPowerContract);

  event SpacesContractUpdated(address indexed newSpacesContract);
}
