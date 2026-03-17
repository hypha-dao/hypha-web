// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/MutualCreditTokenFactoryStorage.sol';
import './MutualCreditSpaceToken.sol';
import './interfaces/IMutualCreditTokenFactory.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract MutualCreditTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  MutualCreditTokenFactoryStorage,
  IMutualCreditTokenFactory
{
  address public mutualCreditTokenImplementation;

  event MutualCreditTokenImplementationUpdated(address indexed implementation);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function setMutualCreditTokenImplementation(
    address _implementation
  ) external onlyOwner {
    require(
      _implementation != address(0),
      'Implementation cannot be zero address'
    );
    mutualCreditTokenImplementation = _implementation;
    emit MutualCreditTokenImplementationUpdated(_implementation);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );
    spacesContract = _spacesContract;
    emit SpacesContractUpdated(_spacesContract);
  }

  function setVotingPowerContract(
    address _votingPowerContract
  ) external onlyOwner {
    require(
      _votingPowerContract != address(0),
      'Voting power contract cannot be zero address'
    );
    votingPowerContract = _votingPowerContract;
    emit VotingPowerContractUpdated(_votingPowerContract);
  }

  /**
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply Maximum supply for executor mints (0 = unlimited). Does not cap credit mints.
   * @param transferable Whether the token can be freely transferred
   * @param fixedMaxSupply If true, maxSupply cannot be changed later
   * @param autoMinting If true, executor can auto-mint on transfer
   * @param tokenPrice Token price (6 decimals, e.g., 1_000_000 = 1.00)
   * @param priceCurrencyFeed Chainlink X/USD feed for the currency (address(0) = USD)
   * @param useTransferWhitelist If true, enforce transfer whitelist
   * @param useReceiveWhitelist If true, enforce receive whitelist
   * @param initialTransferWhitelist Initial addresses that can send tokens
   * @param initialReceiveWhitelist Initial addresses that can receive tokens
   * @param defaultCreditLimit Default credit limit for members of whitelisted spaces
   * @param initialCreditWhitelistSpaceIds Space IDs whose members receive credit eligibility
   * @return The address of the deployed token
   */
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
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      mutualCreditTokenImplementation != address(0),
      'Mutual credit token implementation not set'
    );

    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    bytes memory callData = abi.encodeWithSelector(
      MutualCreditSpaceToken.initialize.selector,
      name,
      symbol,
      spaceExecutor,
      spaceId,
      maxSupply,
      transferable,
      fixedMaxSupply,
      autoMinting,
      tokenPrice,
      priceCurrencyFeed,
      useTransferWhitelist,
      useReceiveWhitelist,
      initialTransferWhitelist,
      initialReceiveWhitelist,
      defaultCreditLimit,
      initialCreditWhitelistSpaceIds
    );

    address tokenAddress = address(
      new ERC1967Proxy(mutualCreditTokenImplementation, callData)
    );

    isTokenDeployedByFactory[tokenAddress] = true;
    allSpaceTokens[spaceId].push(tokenAddress);

    emit TokenDeployed(spaceId, tokenAddress, name, symbol);
    emit MutualCreditTokenParameters(tokenAddress, defaultCreditLimit);

    return tokenAddress;
  }

  function getSpaceToken(
    uint256 spaceId
  ) public view returns (address[] memory) {
    return allSpaceTokens[spaceId];
  }
}
