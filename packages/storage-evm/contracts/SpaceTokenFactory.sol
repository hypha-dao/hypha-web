// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import './storage/SpaceTokenFactoryStorage.sol';
import './SpaceToken.sol';
import './extensions/DecayExtension.sol';
import './extensions/MutualCreditExtension.sol';
import './interfaces/ISpaceTokenFactory.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @title SpaceTokenFactory
 * @dev Unified factory. Deploys a SpaceToken proxy and optionally clones
 *      DecayExtension / MutualCreditExtension instances for the token.
 *      Extension implementations are deployed once; each token gets a cheap
 *      EIP-1167 minimal-proxy clone with independent storage.
 */
contract SpaceTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  SpaceTokenFactoryStorage,
  ISpaceTokenFactory
{
  address public spaceTokenImplementation;
  address public decayExtensionImplementation;
  address public mutualCreditExtensionImplementation;

  event SpaceTokenImplementationUpdated(address indexed impl);
  event DecayExtensionImplementationUpdated(address indexed impl);
  event MutualCreditExtensionImplementationUpdated(address indexed impl);
  event ExtensionDeployed(
    address indexed tokenAddress,
    address indexed extensionAddress,
    string extensionType
  );

  struct FeatureConfig {
    bool decayEnabled;
    uint256 decayPercentage;
    uint256 decayInterval;
    bool mutualCreditEnabled;
    uint256 defaultCreditLimit;
    uint256[] initialCreditWhitelistSpaceIds;
    bool ownershipRestricted;
    address escrowContract;
  }

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

  // =========================================================================
  // Configuration (owner only)
  // =========================================================================

  function setSpaceTokenImplementation(address _impl) external onlyOwner {
    require(_impl != address(0), 'Zero address');
    spaceTokenImplementation = _impl;
    emit SpaceTokenImplementationUpdated(_impl);
  }

  function setDecayExtensionImplementation(address _impl) external onlyOwner {
    require(_impl != address(0), 'Zero address');
    decayExtensionImplementation = _impl;
    emit DecayExtensionImplementationUpdated(_impl);
  }

  function setMutualCreditExtensionImplementation(
    address _impl
  ) external onlyOwner {
    require(_impl != address(0), 'Zero address');
    mutualCreditExtensionImplementation = _impl;
    emit MutualCreditExtensionImplementationUpdated(_impl);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(_spacesContract != address(0), 'Zero address');
    spacesContract = _spacesContract;
    emit SpacesContractUpdated(_spacesContract);
  }

  function setVotingPowerContract(
    address _votingPowerContract
  ) external onlyOwner {
    require(_votingPowerContract != address(0), 'Zero address');
    votingPowerContract = _votingPowerContract;
    emit VotingPowerContractUpdated(_votingPowerContract);
  }

  // =========================================================================
  // Deploy
  // =========================================================================

  function deployToken(
    uint256 spaceId,
    SpaceToken.TokenConfig memory base,
    FeatureConfig memory features
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      spaceTokenImplementation != address(0),
      'Token implementation not set'
    );

    address spaceExecutor = IDAOSpaceFactory(spacesContract)
      .getSpaceExecutor(spaceId);
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    // Override security-critical fields
    base.executor = spaceExecutor;
    base.spaceId = spaceId;
    base.spacesContract = spacesContract;
    base.ownershipRestricted = features.ownershipRestricted;
    base.escrowContract = features.escrowContract;

    // --- Clone extensions ---
    uint256 extCount = 0;
    if (features.decayEnabled) extCount++;
    if (features.mutualCreditEnabled) extCount++;

    address[] memory exts = new address[](extCount);
    address balMod = address(0);
    uint256 idx = 0;

    if (features.decayEnabled) {
      require(
        decayExtensionImplementation != address(0),
        'Decay extension impl not set'
      );
      address decay = Clones.clone(decayExtensionImplementation);
      DecayExtension(decay).initialize(
        features.decayPercentage,
        features.decayInterval
      );
      exts[idx++] = decay;
      balMod = decay;
      emit ExtensionDeployed(address(0), decay, 'decay');
    }

    if (features.mutualCreditEnabled) {
      require(
        mutualCreditExtensionImplementation != address(0),
        'Credit extension impl not set'
      );
      address credit = Clones.clone(mutualCreditExtensionImplementation);
      MutualCreditExtension(credit).initialize(
        features.defaultCreditLimit,
        features.initialCreditWhitelistSpaceIds
      );
      exts[idx++] = credit;
      emit ExtensionDeployed(address(0), credit, 'mutualCredit');
    }

    // --- Deploy token proxy ---
    bytes memory callData = abi.encodeWithSelector(
      SpaceToken.initialize.selector,
      base,
      exts,
      balMod
    );

    address tokenAddress = address(
      new ERC1967Proxy(spaceTokenImplementation, callData)
    );

    isTokenDeployedByFactory[tokenAddress] = true;
    allSpaceTokens[spaceId].push(tokenAddress);

    emit TokenDeployed(spaceId, tokenAddress, base.name, base.symbol);

    return tokenAddress;
  }

  function getSpaceToken(
    uint256 spaceId
  ) public view returns (address[] memory) {
    return allSpaceTokens[spaceId];
  }
}
