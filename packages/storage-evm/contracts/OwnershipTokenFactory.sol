// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/OwnershipTokenFactoryStorage.sol';
import './OwnershipSpaceToken.sol';
import './interfaces/IOwnershipTokenFactory.sol';
import './interfaces/IOwnershipTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract OwnershipTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  OwnershipTokenFactoryStorage,
  IOwnershipTokenFactory
{
  address public ownershipTokenImplementation;

  event OwnershipTokenImplementationUpdated(address indexed implementation);

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

  function setOwnershipTokenImplementation(
    address _implementation
  ) external onlyOwner {
    require(
      _implementation != address(0),
      'Implementation cannot be zero address'
    );
    ownershipTokenImplementation = _implementation;
    emit OwnershipTokenImplementationUpdated(_implementation);
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
   * @dev Deploy an ownership token (transfers only by executor between space members)
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply The maximum token supply (0 for unlimited)
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
   * @param paymentToken ERC20 payment token for token purchases (address(0) disables sale)
   * @param paymentTokenPricePerToken Payment token amount per 1 token unit
   * @param tokensForSale Max amount of tokens available for purchase
   * @param purchaseEligibilityMode 0=issuer space only, 1=custom spaces, 2=all spaces
   * @param initialPurchaseWhitelistSpaceIds Space IDs allowed when mode = custom spaces
   * @return The address of the deployed token
   */
  function deployOwnershipToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
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
    p.paymentToken = paymentToken;
    p.paymentTokenPricePerToken = paymentTokenPricePerToken;
    p.tokensForSale = tokensForSale;
    p.purchaseEligibilityMode = purchaseEligibilityMode;
    p.initialPurchaseWhitelistSpaceIds = initialPurchaseWhitelistSpaceIds;
    // initialAuthorizedMinters intentionally left empty
    return deployOwnershipTokenWithMinters(p);
  }

  /**
   * @dev All inputs for {deployOwnershipTokenWithMinters}. The space executor is
   * derived from the spaces contract and never taken from the caller.
   */
  struct DeployParams {
    uint256 spaceId;
    string name;
    string symbol;
    uint256 maxSupply;
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
    address paymentToken;
    uint256 paymentTokenPricePerToken;
    uint256 tokensForSale;
    uint8 purchaseEligibilityMode;
    uint256[] initialPurchaseWhitelistSpaceIds;
    address[] initialAuthorizedMinters;
  }

  /**
   * @dev Deploy an ownership token, optionally granting the supplied addresses
   * authorized-minter rights on the new token, in addition to the space
   * executor/owner. Accepts a struct to keep the argument list off the stack.
   */
  function deployOwnershipTokenWithMinters(
    DeployParams memory p
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      ownershipTokenImplementation != address(0),
      'Ownership token implementation not set'
    );

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
        ownershipTokenImplementation,
        _encodeInit(p, spaceExecutor)
      )
    );

    isTokenDeployedByFactory[tokenAddress] = true;
    allSpaceTokens[p.spaceId].push(tokenAddress);

    emit TokenDeployed(p.spaceId, tokenAddress, p.name, p.symbol);

    return tokenAddress;
  }

  /// @dev Encodes the token initialize() call from a memory struct, keeping the
  /// large argument list off the stack to avoid stack-too-deep.
  function _encodeInit(
    DeployParams memory p,
    address executor
  ) private view returns (bytes memory) {
    return
      abi.encodeWithSelector(
        OwnershipSpaceToken.initialize.selector,
        p.name,
        p.symbol,
        executor,
        p.spaceId,
        p.maxSupply,
        spacesContract,
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
