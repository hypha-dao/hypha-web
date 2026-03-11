// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMutualCreditTokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;

  function setVotingPowerContract(address _votingPowerContract) external;

  function deployMutualCreditToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 tokenPrice,
    address priceCurrencyFeed,
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist,
    uint256 defaultCreditLimit,
    uint256[] memory initialCreditWhitelistSpaceIds
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

  event MutualCreditTokenParameters(
    address indexed tokenAddress,
    uint256 defaultCreditLimit
  );

  event VotingPowerContractUpdated(address indexed newVotingPowerContract);

  event SpacesContractUpdated(address indexed newSpacesContract);
}
