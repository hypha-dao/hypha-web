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

contract DecayingTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  DecayingTokenFactoryStorage,
  IDecayingTokenFactory
{
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
   * @param isVotingToken Whether to register this as the space's voting token
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
    bool isVotingToken,
    uint256 decayPercentage,
    uint256 decayInterval
  ) public override returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      decayPercentage > 0 && decayPercentage <= 10_000,
      'Decay percentage must be between 1 and 10000 bp'
    );
    require(decayInterval > 0, 'Decay interval must be greater than 0');

    // If isVotingToken is true, ensure a decay voting power contract is set
    if (isVotingToken) {
      require(
        decayVotingPowerContract != address(0),
        'Decay voting power contract not set'
      );
    }

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    // Deploy a decaying token
    DecayingSpaceToken newToken = new DecayingSpaceToken(
      name,
      symbol,
      spaceExecutor,
      spaceId,
      maxSupply,
      transferable,
      decayPercentage,
      decayInterval
    );
    address tokenAddress = address(newToken);
    isTokenDeployedByFactory[tokenAddress] = true;

    // Store the mapping of spaceId to token address
    spaceTokens[spaceId] = tokenAddress;

    emit TokenDeployed(spaceId, tokenAddress, name, symbol);
    emit DecayingTokenParameters(tokenAddress, decayPercentage, decayInterval);

    // No need to explicitly add token to space anymore
    // SpaceFactory.hasToken() now checks the token's spaceId directly

    // Register as voting token if requested
    if (isVotingToken) {
      IDecayTokenVotingPower(decayVotingPowerContract).setSpaceToken(
        spaceId,
        tokenAddress
      );
      emit VotingTokenSet(spaceId, tokenAddress);
    }

    return tokenAddress;
  }

  /**
   * @dev Get the token address for a given space ID
   * @param spaceId The space ID to query
   * @return The address of the token deployed for the space (most recently deployed if multiple)
   */
  function getSpaceToken(uint256 spaceId) public view returns (address) {
    return spaceTokens[spaceId];
  }
}
