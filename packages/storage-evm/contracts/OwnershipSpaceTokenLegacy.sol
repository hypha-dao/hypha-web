// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @dev Interface for querying escrow creator
 */
interface IEscrowCreatorQueryLegacy {
  function getEscrowCreator(uint256 _escrowId) external view returns (address);

  function escrowExists(uint256 _escrowId) external view returns (bool);
}

/**
 * @title OwnershipSpaceTokenLegacy
 * @dev Drop-in upgrade implementation for ownership space tokens deployed from
 * the PRE-mutual-credit implementation line (e.g. Hypha Energy Participations /
 * EPARTS at 0x5d3394CAa6D09214aB86CF048e39dea058eC1921, impl
 * 0x44F182819CB3e5A4E90851829bA870c6Ee41B9D1 on Base).
 *
 * WHY THIS CONTRACT EXISTS — STORAGE LAYOUT:
 * That implementation predates mutual credit, the token sale and authorized
 * minters. Its RegularSpaceToken base storage ends at `_customSymbol`
 * (slot 15) and OwnershipSpaceToken's `ownershipSpacesContract` sits at
 * slot 16 (verified on-chain: slot 16 = 0xc8B8...9cd9):
 *
 *   slot 0  spaceId
 *   slot 1  maxSupply
 *   slot 2  transferable | executor                  (packed)
 *   slot 3  transferHelper | fixedMaxSupply | autoMinting (packed)
 *   slot 4  priceInUSD
 *   slot 5  canTransfer
 *   slot 6  canReceive
 *   slot 7  useTransferWhitelist | useReceiveWhitelist | archived (packed)
 *   slot 8  _transferWhitelistedSpaceIds
 *   slot 9  _receiveWhitelistedSpaceIds
 *   slot 10 isTransferWhitelistedSpace
 *   slot 11 isReceiveWhitelistedSpace
 *   slot 12 priceCurrencyFeed
 *   slot 13 tokenPrice
 *   slot 14 _customName
 *   slot 15 _customSymbol
 *   slot 16 ownershipSpacesContract
 *
 * Upgrading such a proxy to the CURRENT OwnershipSpaceToken would shift
 * `ownershipSpacesContract` down by the newer base variables plus the 50-slot
 * gap, breaking membership checks and bleeding its value into
 * `defaultCreditLimit`-era slots. This contract flattens RegularSpaceToken +
 * OwnershipSpaceToken keeping the deployed slots 0-16 in place and appending
 * every newer variable AFTER them.
 *
 * FUNCTIONALITY: identical to the current OwnershipSpaceToken (authorized
 * minters, mutual credit administration, token sale, escrow transfers,
 * member-restricted transfers, etc.).
 *
 * MAINTENANCE: this contract must be kept in sync with RegularSpaceToken /
 * OwnershipSpaceToken by hand. When changing those contracts, mirror the
 * change here (storage additions go before __gap, never between existing
 * variables).
 */
contract OwnershipSpaceTokenLegacy is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  using SafeERC20 for IERC20;
  uint8 public constant PURCHASE_MODE_SPACE_ONLY = 0;
  uint8 public constant PURCHASE_MODE_CUSTOM_SPACES = 1;
  uint8 public constant PURCHASE_MODE_ALL_SPACES = 2;

  // ===========================================================================
  // LEGACY STORAGE — slots 0-16 of the deployed proxies. DO NOT reorder,
  // retype, remove or insert anything in this block.
  // ===========================================================================

  // slots 0-7
  uint256 public spaceId;
  uint256 public maxSupply;
  bool public transferable;
  address public executor;
  address public transferHelper;
  bool public fixedMaxSupply; // If true, maxSupply cannot be changed
  bool public autoMinting; // If true, executor can mint on transfer; if false, must mint separately
  uint256 public priceInUSD; // Token price in USD (with 6 decimals, e.g., 1000000 = $1)
  mapping(address => bool) public canTransfer; // Who can send tokens
  mapping(address => bool) public canReceive; // Who can receive tokens
  bool public useTransferWhitelist; // If true, enforce transfer whitelist
  bool public useReceiveWhitelist; // If true, enforce receive whitelist
  bool public archived; // If true, minting and transfers are disabled

  // slots 8-11: space-based whitelisting
  uint256[] internal _transferWhitelistedSpaceIds; // Space IDs whose members can transfer
  uint256[] internal _receiveWhitelistedSpaceIds; // Space IDs whose members can receive
  mapping(uint256 => bool) public isTransferWhitelistedSpace; // Quick lookup for transfer whitelist
  mapping(uint256 => bool) public isReceiveWhitelistedSpace; // Quick lookup for receive whitelist

  // slots 12-13: pricing
  address public priceCurrencyFeed;
  uint256 public tokenPrice;

  // slots 14-15: custom name/symbol overrides
  string private _customName;
  string private _customSymbol;

  // slot 16: OwnershipSpaceToken derived storage
  address public ownershipSpacesContract;

  // ===========================================================================
  // NEWER STORAGE — everything added to the token contracts after the legacy
  // implementations were deployed. Appended after the legacy block so existing
  // proxy state is untouched; all of it reads as zero (= feature disabled)
  // right after the upgrade. Only append below, before __gap.
  // ===========================================================================

  // Hardcoded spaces contract address for membership checks
  address public constant spacesContract =
    0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9;

  // Hardcoded escrow contract address
  address public constant escrowContract =
    0x447A317cA5516933264Cdd6aeee0633Fa954B576;

  // Mutual credit storage
  uint256 public defaultCreditLimit;
  mapping(address => uint256) public creditBalanceOf;
  uint256[] internal _creditWhitelistedSpaceIds;
  mapping(uint256 => bool) public isCreditWhitelistedSpace;

  // Primary sale configuration
  address public paymentToken;
  uint256 public paymentTokenPricePerToken; // 6 decimals, priced per 1e18 token units
  uint256 public tokensForSale; // 18 decimals, 0 means sale disabled
  uint256 public tokensSold;
  uint8 public purchaseEligibilityMode; // 0: issuer space only, 1: custom spaces, 2: any space
  uint256[] internal _purchaseWhitelistedSpaceIds;
  mapping(uint256 => bool) public isPurchaseWhitelistedSpace;

  // Address-level mutual credit eligibility
  mapping(address => bool) public isCreditWhitelistedAddress;

  // Authorized minter keys. Addresses set to true are granted mint, burnFrom and
  // batchSetCreditWhitelistAddresses rights, in addition to the executor/owner.
  mapping(address => bool) public isAuthorizedMinter;

  // Reserved storage slots for upgrade-safe additions to this contract.
  // When adding a new state variable above, decrement the gap size by the
  // number of slots it consumes so the layout stays fixed.
  uint256[50] private __gap;

  // Events
  event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
  event TransferableUpdated(bool transferable);
  event AutoMintingUpdated(bool autoMinting);
  event PriceInUSDUpdated(uint256 oldPrice, uint256 newPrice);
  event PriceCurrencyUpdated(uint256 price, address currencyFeed);
  event ArchivedStatusUpdated(bool archived);
  event TokenNameUpdated(string oldName, string newName);
  event TokenSymbolUpdated(string oldSymbol, string newSymbol);
  event TransferWhitelistUpdated(address indexed account, bool canTransfer);
  event ReceiveWhitelistUpdated(address indexed account, bool canReceive);
  event UseTransferWhitelistUpdated(bool enabled);
  event UseReceiveWhitelistUpdated(bool enabled);
  event TokensBurned(
    address indexed burner,
    address indexed from,
    uint256 amount
  );
  event TransferWhitelistSpaceAdded(uint256 indexed spaceId);
  event TransferWhitelistSpaceRemoved(uint256 indexed spaceId);
  event ReceiveWhitelistSpaceAdded(uint256 indexed spaceId);
  event ReceiveWhitelistSpaceRemoved(uint256 indexed spaceId);
  event DefaultCreditLimitUpdated(uint256 oldLimit, uint256 newLimit);
  event CreditUsed(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditRepaid(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditWhitelistSpaceAdded(uint256 indexed spaceId);
  event CreditWhitelistSpaceRemoved(uint256 indexed spaceId);
  event CreditWhitelistAddressUpdated(address indexed account, bool allowed);
  event TokenSaleConfigured(
    address indexed paymentToken,
    uint256 paymentTokenPricePerToken,
    uint256 tokensForSale
  );
  event TokensPurchased(
    address indexed buyer,
    uint256 tokenAmount,
    uint256 paymentAmount,
    address indexed treasury
  );
  event PurchaseEligibilityModeUpdated(uint8 mode);
  event PurchaseWhitelistSpaceAdded(uint256 indexed spaceId);
  event PurchaseWhitelistSpaceRemoved(uint256 indexed spaceId);
  event AuthorizedMinterUpdated(address indexed account, bool allowed);

  // Ownership token events
  event TransferRejected(address from, address to, string reason);
  event OwnershipSpacesContractUpdated(
    address indexed oldSpacesContract,
    address indexed newSpacesContract
  );

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /**
   * @dev Initializer for FRESH proxy deployments only. The legacy proxies this
   * implementation targets are already initialized, so this can never run on
   * them (initializer guard). Mirrors OwnershipSpaceToken.initialize.
   */
  function initialize(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    address _spacesContract,
    bool _fixedMaxSupply,
    bool _autoMinting,
    uint256 _tokenPrice,
    address _priceCurrencyFeed,
    bool _useTransferWhitelist,
    bool _useReceiveWhitelist,
    address[] memory _initialTransferWhitelist,
    address[] memory _initialReceiveWhitelist,
    uint256[] memory _initialTransferWhitelistSpaceIds,
    uint256[] memory _initialReceiveWhitelistSpaceIds,
    address _paymentToken,
    uint256 _paymentTokenPricePerToken,
    uint256 _tokensForSale,
    uint8 _purchaseEligibilityMode,
    uint256[] memory _initialPurchaseWhitelistSpaceIds,
    address[] memory _initialAuthorizedMinters
  ) public initializer {
    require(_spacesContract != address(0), '!zero addr');

    __ERC20_init(name, symbol);
    __ERC20Burnable_init();
    __Ownable_init(0x2687fe290b54d824c136Ceff2d5bD362Bc62019a);
    __UUPSUpgradeable_init();

    executor = _executor;
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = true; // Ownership tokens are always transferable by executor
    transferHelper = 0x479002F7602579203ffba3eE84ACC1BC5b0d6785;

    fixedMaxSupply = _fixedMaxSupply;
    autoMinting = _autoMinting;
    priceInUSD = _tokenPrice; // Legacy field — kept in sync
    tokenPrice = _tokenPrice;
    priceCurrencyFeed = _priceCurrencyFeed;
    useTransferWhitelist = _useTransferWhitelist;
    useReceiveWhitelist = _useReceiveWhitelist;

    // Executor is always whitelisted for both sending and receiving
    canTransfer[_executor] = true;
    canReceive[_executor] = true;

    for (uint256 i = 0; i < _initialTransferWhitelist.length; i++) {
      canTransfer[_initialTransferWhitelist[i]] = true;
    }

    for (uint256 i = 0; i < _initialReceiveWhitelist.length; i++) {
      canReceive[_initialReceiveWhitelist[i]] = true;
    }

    for (uint256 i = 0; i < _initialTransferWhitelistSpaceIds.length; i++) {
      _addSpaceToList(
        _transferWhitelistedSpaceIds,
        isTransferWhitelistedSpace,
        _initialTransferWhitelistSpaceIds[i]
      );
    }

    for (uint256 i = 0; i < _initialReceiveWhitelistSpaceIds.length; i++) {
      _addSpaceToList(
        _receiveWhitelistedSpaceIds,
        isReceiveWhitelistedSpace,
        _initialReceiveWhitelistSpaceIds[i]
      );
    }

    // Optional initial sale configuration. Keeping zero values means "sale disabled".
    if (_paymentToken != address(0)) {
      paymentToken = _paymentToken;
      paymentTokenPricePerToken = _paymentTokenPricePerToken;
      tokensForSale = _tokensForSale;
      tokensSold = 0;
    }

    require(_purchaseEligibilityMode <= PURCHASE_MODE_ALL_SPACES, 'bad mode');
    purchaseEligibilityMode = _purchaseEligibilityMode;
    for (uint256 i = 0; i < _initialPurchaseWhitelistSpaceIds.length; i++) {
      _addSpaceToList(
        _purchaseWhitelistedSpaceIds,
        isPurchaseWhitelistedSpace,
        _initialPurchaseWhitelistSpaceIds[i]
      );
    }

    for (uint256 i = 0; i < _initialAuthorizedMinters.length; i++) {
      isAuthorizedMinter[_initialAuthorizedMinters[i]] = true;
    }

    ownershipSpacesContract = _spacesContract;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // ===========================================================================
  // Ownership token specifics (mirrors OwnershipSpaceToken)
  // ===========================================================================

  /**
   * @dev Sets the spaces contract used for ownership membership checks.
   * Allows recovering older upgraded proxies where this field was never initialized.
   */
  function setOwnershipSpacesContract(address _spacesContract) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      '!executor/owner'
    );
    require(_spacesContract != address(0), '!zero addr');

    address oldSpacesContract = ownershipSpacesContract;
    ownershipSpacesContract = _spacesContract;
    emit OwnershipSpacesContractUpdated(oldSpacesContract, _spacesContract);
  }

  /**
   * @dev Check if an address is a member of the space
   */
  function _isSpaceMember(address account) internal view returns (bool) {
    // Backward compatibility:
    // Some older proxies were upgraded without initializing ownershipSpacesContract.
    // Fallback to the canonical parent spaces contract in that case.
    address membershipSpacesContract = ownershipSpacesContract == address(0)
      ? spacesContract
      : ownershipSpacesContract;
    return
      IDAOSpaceFactory(membershipSpacesContract).isMember(spaceId, account);
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    address sender = _msgSender();
    _validateTransferAccess(sender, to, sender);
    _autoMintIfNeeded(sender, amount);

    if (to == escrowContract && _isSpaceMember(sender)) {
      revert('use escrow fn');
    }

    require(sender == executor, '!executor');
    require(_isSpaceMember(to), '!member');
    _transfer(sender, to, amount);
    return true;
  }

  /**
   * @dev Transfer tokens to a specific escrow
   * Only allows transfer if the escrow was created by the space executor
   */
  function transferToEscrow(
    uint256 escrowId,
    uint256 amount
  ) external returns (bool) {
    require(!archived, 'archived');
    require(_isSpaceMember(msg.sender), '!member');

    IEscrowCreatorQueryLegacy escrowQuery = IEscrowCreatorQueryLegacy(
      escrowContract
    );

    // Check if escrow exists
    require(escrowQuery.escrowExists(escrowId), '!escrow');

    // Check if escrow was created by the space executor
    address escrowCreator = escrowQuery.getEscrowCreator(escrowId);
    require(escrowCreator == executor, '!escrow creator');

    _transfer(msg.sender, escrowContract, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    _validateTransferAccess(from, to, spender);
    _autoMintIfNeeded(from, amount);

    if (spender == escrowContract && _isSpaceMember(to)) {
      _transfer(from, to, amount);
      return true;
    }

    if (spender == transferHelper) {
      require(_isSpaceMember(to), '!member');
      _transfer(from, to, amount);
      return true;
    }

    require(spender == executor, '!executor');
    require(_isSpaceMember(to), '!member');
    _transfer(from, to, amount);
    return true;
  }

  function mint(address to, uint256 amount) public {
    require(
      msg.sender == executor || isAuthorizedMinter[msg.sender],
      '!executor'
    );
    // Executor mints are restricted to space members; authorized minters are not.
    if (msg.sender == executor) {
      require(_isSpaceMember(to) || to == executor, '!member/executor');
    }
    _mintWithSupplyChecks(to, amount);
  }

  // ===========================================================================
  // Shared base logic (mirrors RegularSpaceToken)
  // ===========================================================================

  function _mintWithSupplyChecks(address to, uint256 amount) internal {
    require(!archived, 'archived');
    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'supply exceeded'
    );

    _mint(to, amount);
  }

  function _validateTransferAccess(
    address from,
    address to,
    address spender
  ) internal view {
    require(!archived, 'archived');
    require(transferable || spender == executor, '!transferable');
    if (from != executor && useTransferWhitelist) {
      require(
        canTransfer[from] || _isInTransferWhitelistedSpace(from),
        '!send whitelist'
      );
    }
    if (to != executor && useReceiveWhitelist) {
      require(
        canReceive[to] || _isInReceiveWhitelistedSpace(to),
        '!recv whitelist'
      );
    }
  }

  function _autoMintIfNeeded(address account, uint256 amount) internal {
    if (account == executor && autoMinting) {
      uint256 bal = balanceOf(account);
      if (bal < amount) {
        _mintWithSupplyChecks(account, amount - bal);
      }
    }
  }

  /**
   * @dev Burn tokens from any address (executor / authorized minters burn
   * without approval; others need allowance)
   */
  function burnFrom(address from, uint256 amount) public override {
    if (msg.sender == executor || isAuthorizedMinter[msg.sender]) {
      // Executor and authorized minters can burn without approval
      _burn(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    } else {
      // Others need approval
      super.burnFrom(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    }
  }

  /**
   * @dev Update max supply (only if not fixed)
   */
  function setMaxSupply(uint256 newMaxSupply) external {
    require(msg.sender == executor, '!executor');
    require(!fixedMaxSupply, 'supply fixed');
    require(
      newMaxSupply == 0 || newMaxSupply >= totalSupply(),
      'supply < total'
    );

    uint256 oldMaxSupply = maxSupply;
    maxSupply = newMaxSupply;
    emit MaxSupplyUpdated(oldMaxSupply, newMaxSupply);
  }

  /**
   * @dev Update transferable status
   */
  function setTransferable(bool _transferable) external {
    require(msg.sender == executor, '!executor');
    transferable = _transferable;
    emit TransferableUpdated(_transferable);
  }

  /**
   * @dev Update archived status
   */
  function setArchived(bool _archived) external {
    require(msg.sender == executor, '!executor');
    archived = _archived;
    emit ArchivedStatusUpdated(_archived);
  }

  /**
   * @dev Returns the name of the token.
   * If a custom name has been set, it overrides the original ERC20 name.
   */
  function name() public view override returns (string memory) {
    if (bytes(_customName).length > 0) {
      return _customName;
    }
    return super.name();
  }

  /**
   * @dev Returns the symbol of the token.
   * If a custom symbol has been set, it overrides the original ERC20 symbol.
   */
  function symbol() public view override returns (string memory) {
    if (bytes(_customSymbol).length > 0) {
      return _customSymbol;
    }
    return super.symbol();
  }

  /**
   * @dev Update the token name
   */
  function setTokenName(string memory newName) external {
    require(msg.sender == executor, '!executor');
    require(bytes(newName).length > 0, 'empty name');
    string memory oldName = name();
    _customName = newName;
    emit TokenNameUpdated(oldName, newName);
  }

  /**
   * @dev Update the token symbol
   */
  function setTokenSymbol(string memory newSymbol) external {
    require(msg.sender == executor, '!executor');
    require(bytes(newSymbol).length > 0, 'empty symbol');
    string memory oldSymbol = symbol();
    _customSymbol = newSymbol;
    emit TokenSymbolUpdated(oldSymbol, newSymbol);
  }

  /**
   * @dev Update auto-minting status
   */
  function setAutoMinting(bool _autoMinting) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      '!executor/owner'
    );
    autoMinting = _autoMinting;
    emit AutoMintingUpdated(_autoMinting);
  }

  /**
   * @dev Update token price in USD
   */
  function setPriceInUSD(uint256 newPrice) external {
    require(msg.sender == executor, '!executor');
    uint256 oldPrice = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    emit PriceInUSDUpdated(oldPrice, newPrice);
  }

  /**
   * @dev Update token price and specify which currency it's denominated in.
   */
  function setPriceWithCurrency(
    uint256 newPrice,
    address currencyFeed
  ) external {
    require(msg.sender == executor, '!executor');
    uint256 oldPrice = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    priceCurrencyFeed = currencyFeed;
    emit PriceInUSDUpdated(oldPrice, newPrice);
    emit PriceCurrencyUpdated(newPrice, currencyFeed);
  }

  /**
   * @dev Set the transfer helper address
   */
  function setTransferHelper(address _transferHelper) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      '!executor/owner'
    );
    transferHelper = _transferHelper;
  }

  // ===========================================================================
  // Token sale
  // ===========================================================================

  /**
   * @dev Configure direct token sale in a payment token.
   */
  function configureTokenSale(
    address _paymentToken,
    uint256 _paymentTokenPricePerToken,
    uint256 _tokensForSale
  ) external {
    require(msg.sender == executor, '!executor');
    require(_paymentToken != address(0), '!zero addr');
    require(_paymentTokenPricePerToken > 0, '!zero price');
    require(_tokensForSale >= tokensSold, 'sale < sold');

    paymentToken = _paymentToken;
    paymentTokenPricePerToken = _paymentTokenPricePerToken;
    tokensForSale = _tokensForSale;

    // Keep existing price fields aligned with sale pricing for consistency.
    priceInUSD = _paymentTokenPricePerToken;
    tokenPrice = _paymentTokenPricePerToken;
    priceCurrencyFeed = address(0);

    emit TokenSaleConfigured(
      _paymentToken,
      _paymentTokenPricePerToken,
      _tokensForSale
    );
  }

  /**
   * @dev Purchase tokens with the configured payment token. Payment tokens are
   * sent directly to the space treasury (executor address).
   */
  function buyTokens(uint256 tokenAmount) external {
    require(!archived, 'archived');
    require(paymentToken != address(0), '!sale');
    require(paymentTokenPricePerToken > 0, '!sale price');
    require(tokensForSale > 0, 'sale disabled');
    require(tokenAmount > 0, '!zero amount');
    require(tokensSold + tokenAmount <= tokensForSale, 'sale cap');
    require(canAccountPurchase(msg.sender), '!eligible');

    // Convert token amount (18 decimals) into payment-token amount.
    uint256 paymentAmount = (tokenAmount * paymentTokenPricePerToken) / 1e18;
    require(paymentAmount > 0, 'amount too small');

    tokensSold += tokenAmount;
    IERC20(paymentToken).safeTransferFrom(msg.sender, executor, paymentAmount);
    _mintWithSupplyChecks(msg.sender, tokenAmount);

    emit TokensPurchased(msg.sender, tokenAmount, paymentAmount, executor);
  }

  /**
   * @dev Get active token sale details.
   */
  function getTokenSaleDetails()
    external
    view
    returns (
      address salePaymentToken,
      uint256 salePricePerToken,
      uint256 tokensLeftToSell
    )
  {
    salePaymentToken = paymentToken;
    salePricePerToken = paymentTokenPricePerToken;
    if (tokensForSale > tokensSold) {
      tokensLeftToSell = tokensForSale - tokensSold;
    } else {
      tokensLeftToSell = 0;
    }
  }

  /**
   * @dev Update purchase eligibility mode.
   */
  function setPurchaseEligibilityMode(uint8 mode) external {
    require(msg.sender == executor, '!executor');
    require(mode <= PURCHASE_MODE_ALL_SPACES, 'bad mode');
    purchaseEligibilityMode = mode;
    emit PurchaseEligibilityModeUpdated(mode);
  }

  function batchAddPurchaseWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _addSpaceToList(
          _purchaseWhitelistedSpaceIds,
          isPurchaseWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit PurchaseWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchRemovePurchaseWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _removeSpaceFromList(
          _purchaseWhitelistedSpaceIds,
          isPurchaseWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit PurchaseWhitelistSpaceRemoved(spaceIds[i]);
      }
    }
  }

  function getPurchaseWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _purchaseWhitelistedSpaceIds;
  }

  // ===========================================================================
  // Transfer / receive whitelists
  // ===========================================================================

  /**
   * @dev Batch update transfer whitelist
   */
  function batchSetTransferWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external {
    require(msg.sender == executor, '!executor');
    require(accounts.length == allowed.length, 'length mismatch');

    for (uint256 i = 0; i < accounts.length; i++) {
      canTransfer[accounts[i]] = allowed[i];
      emit TransferWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Batch update receive whitelist
   */
  function batchSetReceiveWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external {
    require(msg.sender == executor, '!executor');
    require(accounts.length == allowed.length, 'length mismatch');

    for (uint256 i = 0; i < accounts.length; i++) {
      canReceive[accounts[i]] = allowed[i];
      emit ReceiveWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Enable or disable transfer whitelist enforcement
   */
  function setUseTransferWhitelist(bool enabled) external {
    require(msg.sender == executor, '!executor');
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  /**
   * @dev Enable or disable receive whitelist enforcement
   */
  function setUseReceiveWhitelist(bool enabled) external {
    require(msg.sender == executor, '!executor');
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }

  /**
   * @dev Batch add spaces to transfer whitelist
   */
  function batchAddTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _addSpaceToList(
          _transferWhitelistedSpaceIds,
          isTransferWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit TransferWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchAddReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _addSpaceToList(
          _receiveWhitelistedSpaceIds,
          isReceiveWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit ReceiveWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch remove spaces from transfer whitelist
   */
  function batchRemoveTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _removeSpaceFromList(
          _transferWhitelistedSpaceIds,
          isTransferWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit TransferWhitelistSpaceRemoved(spaceIds[i]);
      }
    }
  }

  function batchRemoveReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _removeSpaceFromList(
          _receiveWhitelistedSpaceIds,
          isReceiveWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit ReceiveWhitelistSpaceRemoved(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Get all transfer whitelisted space IDs
   */
  function getTransferWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _transferWhitelistedSpaceIds;
  }

  /**
   * @dev Get all receive whitelisted space IDs
   */
  function getReceiveWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _receiveWhitelistedSpaceIds;
  }

  function _isInTransferWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    return
      _isAccountInSpaceList(
        _transferWhitelistedSpaceIds,
        isTransferWhitelistedSpace,
        account
      );
  }

  function _isInReceiveWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    return
      _isAccountInSpaceList(
        _receiveWhitelistedSpaceIds,
        isReceiveWhitelistedSpace,
        account
      );
  }

  /**
   * @dev Check if an address can transfer tokens
   */
  function canAccountTransfer(address account) public view returns (bool) {
    // Executor always bypasses
    if (account == executor) {
      return true;
    }
    // If transfer whitelist is not enforced, everyone can transfer
    if (!useTransferWhitelist) {
      return true;
    }
    // Check direct whitelist
    if (canTransfer[account]) {
      return true;
    }
    // Check space-based whitelist
    return _isInTransferWhitelistedSpace(account);
  }

  /**
   * @dev Check if an address can receive tokens
   */
  function canAccountReceive(address account) public view returns (bool) {
    // Executor always bypasses
    if (account == executor) {
      return true;
    }
    // If receive whitelist is not enforced, everyone can receive
    if (!useReceiveWhitelist) {
      return true;
    }
    // Check direct whitelist
    if (canReceive[account]) {
      return true;
    }
    // Check space-based whitelist
    return _isInReceiveWhitelistedSpace(account);
  }

  function canAccountPurchase(address account) public view returns (bool) {
    if (purchaseEligibilityMode == PURCHASE_MODE_SPACE_ONLY) {
      return IDAOSpaceFactory(spacesContract).isMember(spaceId, account);
    }
    if (purchaseEligibilityMode == PURCHASE_MODE_CUSTOM_SPACES) {
      return _isInPurchaseWhitelistedSpace(account);
    }
    if (purchaseEligibilityMode == PURCHASE_MODE_ALL_SPACES) {
      return _isInAnySpace(account);
    }
    return false;
  }

  // =========================================================================
  // Mutual credit view functions
  // =========================================================================

  /**
   * @dev Credit limit for an account.
   */
  function creditLimitOf(address account) public view returns (uint256) {
    if (_isCreditEligible(account)) {
      return defaultCreditLimit;
    }
    return 0;
  }

  /**
   * @dev Remaining credit an account can still use before hitting its limit.
   */
  function creditLimitLeftOf(address account) public view returns (uint256) {
    uint256 limit = creditLimitOf(account);
    uint256 used = creditBalanceOf[account];
    if (used >= limit) {
      return 0;
    }
    return limit - used;
  }

  /**
   * @dev Net position: positive means net creditor, negative means net debtor.
   */
  function netBalanceOf(address account) public view returns (int256) {
    return int256(balanceOf(account)) - int256(creditBalanceOf[account]);
  }

  function getCreditWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _creditWhitelistedSpaceIds;
  }

  // =========================================================================
  // Mutual credit administration (executor only)
  // =========================================================================

  function setDefaultCreditLimit(uint256 _limit) external {
    require(msg.sender == executor, '!executor');
    uint256 old = defaultCreditLimit;
    defaultCreditLimit = _limit;
    emit DefaultCreditLimitUpdated(old, _limit);
  }

  /**
   * @dev Enable or update mutual credit in one call.
   */
  function enableCredit(uint256 _limit, uint256[] calldata spaceIds) external {
    require(msg.sender == executor, '!executor');
    uint256 old = defaultCreditLimit;
    defaultCreditLimit = _limit;
    emit DefaultCreditLimitUpdated(old, _limit);
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _addSpaceToList(
          _creditWhitelistedSpaceIds,
          isCreditWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit CreditWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchAddCreditWhitelistSpaces(uint256[] calldata spaceIds) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _addSpaceToList(
          _creditWhitelistedSpaceIds,
          isCreditWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit CreditWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchRemoveCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(msg.sender == executor, '!executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (
        _removeSpaceFromList(
          _creditWhitelistedSpaceIds,
          isCreditWhitelistedSpace,
          spaceIds[i]
        )
      ) {
        emit CreditWhitelistSpaceRemoved(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch set per-address mutual credit eligibility (executor, Ownable
   * owner or authorized minter).
   */
  function batchSetCreditWhitelistAddresses(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external {
    require(
      msg.sender == executor ||
        msg.sender == owner() ||
        isAuthorizedMinter[msg.sender],
      '!executor/owner'
    );
    _batchSetAddressFlags(accounts, allowed, false);
  }

  /**
   * @dev Batch grant/revoke authorized minter keys (executor or Ownable owner).
   */
  function batchSetAuthorizedMinters(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      '!executor/owner'
    );
    _batchSetAddressFlags(accounts, allowed, true);
  }

  /**
   * @dev Shared loop for the two address->bool whitelists. `minter` selects the
   * authorized-minter mapping/event; otherwise the mutual-credit one.
   */
  function _batchSetAddressFlags(
    address[] calldata accounts,
    bool[] calldata allowed,
    bool minter
  ) private {
    require(accounts.length == allowed.length, 'length mismatch');
    for (uint256 i = 0; i < accounts.length; i++) {
      if (minter) {
        isAuthorizedMinter[accounts[i]] = allowed[i];
        emit AuthorizedMinterUpdated(accounts[i], allowed[i]);
      } else {
        isCreditWhitelistedAddress[accounts[i]] = allowed[i];
        emit CreditWhitelistAddressUpdated(accounts[i], allowed[i]);
      }
    }
  }

  // =========================================================================
  // Shared space-list helpers
  // =========================================================================

  function _addSpaceToList(
    uint256[] storage list,
    mapping(uint256 => bool) storage isInList,
    uint256 sid
  ) internal returns (bool) {
    if (!isInList[sid]) {
      isInList[sid] = true;
      list.push(sid);
      return true;
    }
    return false;
  }

  function _removeSpaceFromList(
    uint256[] storage list,
    mapping(uint256 => bool) storage isInList,
    uint256 sid
  ) internal returns (bool) {
    if (isInList[sid]) {
      isInList[sid] = false;
      for (uint256 i = 0; i < list.length; i++) {
        if (list[i] == sid) {
          list[i] = list[list.length - 1];
          list.pop();
          break;
        }
      }
      return true;
    }
    return false;
  }

  function _isAccountInSpaceList(
    uint256[] storage list,
    mapping(uint256 => bool) storage isInList,
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < list.length; i++) {
      uint256 sid = list[i];
      if (
        isInList[sid] &&
        IDAOSpaceFactory(spacesContract).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }

  function _isCreditEligible(address account) internal view returns (bool) {
    return
      isCreditWhitelistedAddress[account] ||
      _isInCreditWhitelistedSpace(account);
  }

  function _isInCreditWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    return
      _isAccountInSpaceList(
        _creditWhitelistedSpaceIds,
        isCreditWhitelistedSpace,
        account
      );
  }

  function _isInPurchaseWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    return
      _isAccountInSpaceList(
        _purchaseWhitelistedSpaceIds,
        isPurchaseWhitelistedSpace,
        account
      );
  }

  function _isInAnySpace(address account) internal view returns (bool) {
    uint256[] memory memberSpaces = IDAOSpaceFactory(spacesContract)
      .getMemberSpaces(account);
    return memberSpaces.length > 0;
  }
}
