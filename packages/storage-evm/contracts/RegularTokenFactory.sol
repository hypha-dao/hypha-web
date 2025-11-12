// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/RegularTokenFactoryStorage.sol';
import './RegularSpaceToken.sol';
import './interfaces/IRegularTokenFactory.sol';
import './interfaces/IRegularTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract RegularTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  RegularTokenFactoryStorage,
  IRegularTokenFactory
{
  address public spaceTokenImplementation;

  event SpaceTokenImplementationUpdated(address indexed implementation);

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

  function setSpaceTokenImplementation(
    address _implementation
  ) external onlyOwner {
    require(
      _implementation != address(0),
      'Implementation cannot be zero address'
    );
    spaceTokenImplementation = _implementation;
    emit SpaceTokenImplementationUpdated(_implementation);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(_spacesContract != address(0), 'Spaces contract cannot be zero');
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
   * @dev Deploy a regular token (without decay)
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply The maximum token supply (0 for unlimited)
   * @param transferable Whether the token can be transferred
   * @param fixedMaxSupply If true, maxSupply cannot be changed later
   * @param autoMinting If true, executor can auto-mint on transfer; if false, must mint separately
   * @param priceInUSD Token price in USD (with 6 decimals, e.g., 1000000 = $1)
   * @param useTransferWhitelist If true, enforce transfer whitelist
   * @param useReceiveWhitelist If true, enforce receive whitelist
   * @return The address of the deployed token
   */
  function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 priceInUSD,
    bool useTransferWhitelist,
    bool useReceiveWhitelist
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      spaceTokenImplementation != address(0),
      'Token implementation not set'
    );

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    bytes memory callData = abi.encodeWithSelector(
      RegularSpaceToken.initialize.selector,
      name,
      symbol,
      spaceExecutor,
      spaceId,
      maxSupply,
      transferable,
      fixedMaxSupply,
      autoMinting,
      priceInUSD,
      useTransferWhitelist,
      useReceiveWhitelist
    );

    address tokenAddress = address(
      new ERC1967Proxy(spaceTokenImplementation, callData)
    );

    isTokenDeployedByFactory[tokenAddress] = true;

    // Store the token in the array of all tokens for this space
    allSpaceTokens[spaceId].push(tokenAddress);

    emit TokenDeployed(spaceId, tokenAddress, name, symbol);

    return tokenAddress;
  }

  /**
   * @dev Get the token address for a given space ID
   * @param spaceId The space ID to query
   * @return The addresses of all tokens deployed for the space
   */
  function getSpaceToken(
    uint256 spaceId
  ) public view returns (address[] memory) {
    return allSpaceTokens[spaceId];
  }
}
