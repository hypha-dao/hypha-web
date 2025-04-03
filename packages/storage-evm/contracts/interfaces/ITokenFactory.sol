// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenFactory {
  function initialize(address initialOwner) external;

  function setSpacesContract(address _spacesContract) external;

  function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply
  ) external returns (address);

  event TokenDeployed(
    uint256 indexed spaceId,
    address indexed tokenAddress,
    string name,
    string symbol
  );
  event SpacesContractUpdated(address indexed newSpacesContract);
}
