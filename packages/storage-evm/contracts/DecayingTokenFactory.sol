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
   * @param tokenPrice Token price (6 decimals, e.g., 1_000_000 = 1.00)
   * @param priceCurrencyFeed Chainlink X/USD feed for the currency (address(0) = USD)
   * @param useTransferWhitelist If true, enforce transfer whitelist
   * @param useReceiveWhitelist If true, enforce receive whitelist
   * @param initialTransferWhitelist Initial addresses that can send tokens
   * @param initialReceiveWhitelist Initial addresses that can receive tokens
   * @param initialTransferWhitelistSpaceIds Space IDs whose members can initially send tokens
   * @param initialReceiveWhitelistSpaceIds Space IDs whose members can initially receive tokens
   * @param decayPercentage The decay percentage in basis points (0-10000)
   * @param decayInterval The interval in seconds between decay periods
   * @param paymentToken ERC20 payment token for token purchases (address(0) disables sale)
   * @param paymentTokenPricePerToken Payment token amount per 1 token unit
   * @param tokensForSale Max amount of tokens available for purchase
   * @param purchaseEligibilityMode 0=issuer space only, 1=custom spaces, 2=all spaces
   * @param initialPurchaseWhitelistSpaceIds Space IDs allowed when mode = custom spaces
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
    uint256 tokenPrice,
    address priceCurrencyFeed,
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist,
    uint256[] memory initialTransferWhitelistSpaceIds,
    uint256[] memory initialReceiveWhitelistSpaceIds,
    uint256 decayPercentage,
    uint256 decayInterval,
    address paymentToken,
    uint256 paymentTokenPricePerToken,
    uint256 tokensForSale,
    uint8 purchaseEligibilityMode,
    uint256[] memory initialPurchaseWhitelistSpaceIds
  ) public returns (address) {
    DeployParams memory p;
    p.spaceId = spaceId;
    p.name = name;
    p.symbol = symbol;
    p.maxSupply = maxSupply;
    p.transferable = transferable;
    p.fixedMaxSupply = fixedMaxSupply;
    p.autoMinting = autoMinting;
    p.tokenPrice = tokenPrice;
    p.priceCurrencyFeed = priceCurrencyFeed;
    p.useTransferWhitelist = useTransferWhitelist;
    p.useReceiveWhitelist = useReceiveWhitelist;
    p.initialTransferWhitelist = initialTransferWhitelist;
    p.initialReceiveWhitelist = initialReceiveWhitelist;
    p.initialTransferWhitelistSpaceIds = initialTransferWhitelistSpaceIds;
    p.initialReceiveWhitelistSpaceIds = initialReceiveWhitelistSpaceIds;
    p.decayPercentage = decayPercentage;
    p.decayInterval = decayInterval;
    p.paymentToken = paymentToken;
    p.paymentTokenPricePerToken = paymentTokenPricePerToken;
    p.tokensForSale = tokensForSale;
    p.purchaseEligibilityMode = purchaseEligibilityMode;
    p.initialPurchaseWhitelistSpaceIds = initialPurchaseWhitelistSpaceIds;
    // initialAuthorizedMinters intentionally left empty
    return deployDecayingTokenWithMinters(p);
  }

  /**
   * @dev All inputs for {deployDecayingTokenWithMinters}. The space executor is
   * derived from the spaces contract and never taken from the caller.
   */
  struct DeployParams {
    uint256 spaceId;
    string name;
    string symbol;
    uint256 maxSupply;
    bool transferable;
    bool fixedMaxSupply;
    bool autoMinting;
    uint256 tokenPrice;
    address priceCurrencyFeed;
    bool useTransferWhitelist;
    bool useReceiveWhitelist;
    address[] initialTransferWhitelist;
    address[] initialReceiveWhitelist;
    uint256[] initialTransferWhitelistSpaceIds;
    uint256[] initialReceiveWhitelistSpaceIds;
    uint256 decayPercentage;
    uint256 decayInterval;
    address paymentToken;
    uint256 paymentTokenPricePerToken;
    uint256 tokensForSale;
    uint8 purchaseEligibilityMode;
    uint256[] initialPurchaseWhitelistSpaceIds;
    address[] initialAuthorizedMinters;
  }

  /**
   * @dev Deploy a decaying token, optionally granting the supplied addresses
   * authorized-minter rights on the new token, in addition to the space
   * executor/owner. Accepts a struct to keep the argument list off the stack.
   */
  function deployDecayingTokenWithMinters(
    DeployParams memory p
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      decayingTokenImplementation != address(0),
      'Decaying token implementation not set'
    );
    require(
      p.decayPercentage > 0 && p.decayPercentage <= 10_000,
      'Decay percentage must be between 1 and 10000 bp'
    );
    require(p.decayInterval > 0, 'Decay interval must be greater than 0');

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      p.spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    address tokenAddress = address(
      new ERC1967Proxy(
        decayingTokenImplementation,
        _encodeInit(p, spaceExecutor)
      )
    );

    isTokenDeployedByFactory[tokenAddress] = true;
    allSpaceTokens[p.spaceId].push(tokenAddress);

    emit TokenDeployed(p.spaceId, tokenAddress, p.name, p.symbol);
    emit DecayingTokenParameters(
      tokenAddress,
      p.decayPercentage,
      p.decayInterval
    );

    return tokenAddress;
  }

  /// @dev Encodes the token initialize() call from a memory struct, keeping the
  /// large argument list off the stack to avoid stack-too-deep.
  function _encodeInit(
    DeployParams memory p,
    address executor
  ) private pure returns (bytes memory) {
    return
      abi.encodeWithSelector(
        DecayingSpaceToken.initialize.selector,
        p.name,
        p.symbol,
        executor,
        p.spaceId,
        p.maxSupply,
        p.transferable,
        p.fixedMaxSupply,
        p.autoMinting,
        p.tokenPrice,
        p.priceCurrencyFeed,
        p.useTransferWhitelist,
        p.useReceiveWhitelist,
        p.initialTransferWhitelist,
        p.initialReceiveWhitelist,
        p.initialTransferWhitelistSpaceIds,
        p.initialReceiveWhitelistSpaceIds,
        p.decayPercentage,
        p.decayInterval,
        p.paymentToken,
        p.paymentTokenPricePerToken,
        p.tokensForSale,
        p.purchaseEligibilityMode,
        p.initialPurchaseWhitelistSpaceIds,
        p.initialAuthorizedMinters
      );
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
