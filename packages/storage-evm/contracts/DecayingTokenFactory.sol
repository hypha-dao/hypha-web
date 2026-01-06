// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/DecayingTokenFactoryStorage.sol';
import './DecayingSpaceToken.sol';
import './interfaces/IDecayingTokenFactory.sol';
import './interfaces/IDecayTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract DecayingTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  DecayingTokenFactoryStorage,
  IDecayingTokenFactory
{
  address public decayingTokenImplementation;

  event DecayingTokenImplementationUpdated(address indexed implementation);

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

  function setDecayingTokenImplementation(
    address _implementation
  ) external onlyOwner {
    require(
      _implementation != address(0),
      'Implementation cannot be zero address'
    );
    decayingTokenImplementation = _implementation;
    emit DecayingTokenImplementationUpdated(_implementation);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );
    spacesContract = _spacesContract;
    emit SpacesContractUpdated(_spacesContract);
  }

  function setDecayVotingPowerContract(
    address _decayVotingPowerContract
  ) external onlyOwner {
    require(
      _decayVotingPowerContract != address(0),
      'Decay voting power contract cannot be zero address'
    );
    decayVotingPowerContract = _decayVotingPowerContract;
    emit DecayVotingPowerContractUpdated(_decayVotingPowerContract);
  }

  /**
   * @dev Deploy a decaying token
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
   * @param initialTransferWhitelist Initial addresses that can send tokens
   * @param initialReceiveWhitelist Initial addresses that can receive tokens
   * @param decayPercentage The decay percentage in basis points (0-10000)
   * @param decayInterval The interval in seconds between decay periods
   * @return The address of the deployed token
   */
  function deployDecayingToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 priceInUSD,
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist,
    uint256 decayPercentage,
    uint256 decayInterval
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      decayingTokenImplementation != address(0),
      'Decaying token implementation not set'
    );
    require(
      decayPercentage > 0 && decayPercentage <= 10_000,
      'Decay percentage must be between 1 and 10000 bp'
    );
    require(decayInterval > 0, 'Decay interval must be greater than 0');

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    bytes memory callData = abi.encodeWithSelector(
      DecayingSpaceToken.initialize.selector,
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
      useReceiveWhitelist,
      initialTransferWhitelist,
      initialReceiveWhitelist,
      decayPercentage,
      decayInterval
    );

    address tokenAddress = address(
      new ERC1967Proxy(decayingTokenImplementation, callData)
    );

    isTokenDeployedByFactory[tokenAddress] = true;

    // Store the token in the array of all tokens for this space
    allSpaceTokens[spaceId].push(tokenAddress);

    emit TokenDeployed(spaceId, tokenAddress, name, symbol);
    emit DecayingTokenParameters(tokenAddress, decayPercentage, decayInterval);

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
