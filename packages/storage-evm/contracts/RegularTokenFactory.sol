// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/RegularTokenFactoryStorage.sol';
import './RegularSpaceToken.sol';
import './interfaces/IRegularTokenFactory.sol';
import './interfaces/IDAOSpaceFactory.sol';
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
   * @dev Deploy a regular token with optional mutual credit support
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply The maximum token supply (0 for unlimited). Does not cap credit mints.
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
   * @param defaultCreditLimit Default credit limit for members of whitelisted spaces (0 = no credit)
   * @param initialCreditWhitelistSpaceIds Space IDs whose members receive credit eligibility
   * @param paymentToken Payment token contract for direct purchases (address(0) disables initial sale)
   * @param paymentTokenPricePerToken Price per 1 token (1e18 units), in payment-token decimals
   * @param tokensForSale Total amount of tokens initially available for sale (18 decimals)
   * @param purchaseEligibilityMode 0=issuer space only, 1=custom spaces, 2=all spaces
   * @param initialPurchaseWhitelistSpaceIds Space IDs used when mode=custom spaces
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
    uint256 tokenPrice,
    address priceCurrencyFeed,
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist,
    uint256[] memory initialTransferWhitelistSpaceIds,
    uint256[] memory initialReceiveWhitelistSpaceIds,
    uint256 defaultCreditLimit,
    uint256[] memory initialCreditWhitelistSpaceIds,
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
    p.defaultCreditLimit = defaultCreditLimit;
    p.initialCreditWhitelistSpaceIds = initialCreditWhitelistSpaceIds;
    p.paymentToken = paymentToken;
    p.paymentTokenPricePerToken = paymentTokenPricePerToken;
    p.tokensForSale = tokensForSale;
    p.purchaseEligibilityMode = purchaseEligibilityMode;
    p.initialPurchaseWhitelistSpaceIds = initialPurchaseWhitelistSpaceIds;
    // initialAuthorizedMinters intentionally left empty
    return deployTokenWithMinters(p);
  }

  /**
   * @dev All inputs for {deployTokenWithMinters}. The space executor is derived
   * from the spaces contract and never taken from the caller.
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
    uint256 defaultCreditLimit;
    uint256[] initialCreditWhitelistSpaceIds;
    address paymentToken;
    uint256 paymentTokenPricePerToken;
    uint256 tokensForSale;
    uint8 purchaseEligibilityMode;
    uint256[] initialPurchaseWhitelistSpaceIds;
    address[] initialAuthorizedMinters;
  }

  /**
   * @dev Deploy a regular token, optionally granting the supplied addresses
   * authorized-minter rights (mint, burnFrom and batchSetCreditWhitelistAddresses)
   * on the new token, in addition to the space executor/owner. Accepts a struct
   * to keep the large argument list off the stack.
   */
  function deployTokenWithMinters(
    DeployParams memory p
  ) public returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      spaceTokenImplementation != address(0),
      'Token implementation not set'
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
        spaceTokenImplementation,
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
  ) private pure returns (bytes memory) {
    return
      abi.encodeWithSelector(
        RegularSpaceToken.initialize.selector,
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
        p.defaultCreditLimit,
        p.initialCreditWhitelistSpaceIds,
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
