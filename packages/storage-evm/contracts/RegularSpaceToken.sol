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

contract RegularSpaceToken is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  using SafeERC20 for IERC20;

  struct PurchaseConfig {
    address usdcToken;
    bool enabled;
    uint256 customPrice;
    uint256 maxTokensForSale;
    uint256 soldTokens;
  }

  bytes32 private constant _PURCHASE_CONFIG_SLOT =
    keccak256('hypha.regular-space-token.purchase.config.v1');

  struct MutualCreditConfig {
    bool enabled;
    uint256 defaultCreditLimit;
    mapping(address => uint256) creditBalanceOf;
    mapping(address => uint256) customCreditLimit;
    mapping(address => bool) hasCustomCreditLimit;
    uint256[] creditWhitelistedSpaceIds;
    mapping(uint256 => bool) isCreditWhitelistedSpace;
  }

  bytes32 private constant _MUTUAL_CREDIT_CONFIG_SLOT =
    keccak256('hypha.regular-space-token.mutual-credit.config.v1');

  uint256 public spaceId;
  uint256 public maxSupply;
  bool public transferable;
  address public executor;
  address public transferHelper;

  // New configuration options
  bool public fixedMaxSupply; // If true, maxSupply cannot be changed
  bool public autoMinting; // If true, executor can mint on transfer; if false, must mint separately
  uint256 public priceInUSD; // Token price in USD (with 6 decimals, e.g., 1000000 = $1)

  // Transfer whitelists
  mapping(address => bool) public canTransfer; // Who can send tokens
  mapping(address => bool) public canReceive; // Who can receive tokens
  bool public useTransferWhitelist; // If true, enforce transfer whitelist
  bool public useReceiveWhitelist; // If true, enforce receive whitelist

  // Archive status - MUST BE AT THE END FOR UPGRADEABILITY
  bool public archived; // If true, minting and transfers are disabled

  // Space-based whitelisting (added for upgradeability - at end of storage)
  // Hardcoded spaces contract address for membership checks
  address public constant spacesContract =
    0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9;
  uint256[] internal _transferWhitelistedSpaceIds; // Space IDs whose members can transfer
  uint256[] internal _receiveWhitelistedSpaceIds; // Space IDs whose members can receive
  mapping(uint256 => bool) public isTransferWhitelistedSpace; // Quick lookup for transfer whitelist
  mapping(uint256 => bool) public isReceiveWhitelistedSpace; // Quick lookup for receive whitelist

  // Price currency — Chainlink X/USD feed address for the currency priceInUSD is denominated in.
  // address(0) = USD (default, backward compatible).
  // e.g., if price is set in CAD, this points to the Chainlink CAD/USD feed.
  address public priceCurrencyFeed;

  // Token price (6 decimals) + currency feed — the clean API.
  // This is the canonical price field. priceCurrencyFeed above specifies the currency.
  // tokenPrice and priceInUSD are kept in sync by all setter functions.
  uint256 public tokenPrice;

  // Custom name/symbol overrides — allows renaming the token after deployment.
  // When set (non-empty), these override the ERC20 name() and symbol() return values.
  string private _customName;
  string private _customSymbol;

  // Events
  event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
  event TransferableUpdated(bool transferable);
  event AutoMintingUpdated(bool autoMinting);
  event PriceInUSDUpdated(uint256 oldPrice, uint256 newPrice);
  event PriceCurrencyUpdated(uint256 price, address currencyFeed);
  event ArchivedStatusUpdated(bool archived);
  event TokenNameUpdated(string oldName, string newName);
  event TokenSymbolUpdated(string oldSymbol, string newSymbol);
  event TransferWhitelistUpdated(address indexed account, bool canTransferFlag);
  event ReceiveWhitelistUpdated(address indexed account, bool canReceiveFlag);
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
  event TokenPurchaseConfigUpdated(
    address indexed usdcToken,
    bool enabled,
    uint256 customPrice,
    uint256 maxTokensForSale,
    bool soldCounterReset
  );
  event SpaceTokenPurchased(
    address indexed buyer,
    address indexed recipient,
    uint256 usdcAmount,
    uint256 tokenAmount
  );
  event MutualCreditConfigured(
    bool enabled,
    uint256 defaultCreditLimit,
    bool whitelistReset
  );
  event DefaultCreditLimitUpdated(uint256 oldLimit, uint256 newLimit);
  event CreditLimitSet(address indexed member, uint256 limit);
  event CreditLimitRemoved(address indexed member);
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
  event CreditForgiven(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditWhitelistSpaceAdded(uint256 indexed spaceId);
  event CreditWhitelistSpaceRemoved(uint256 indexed spaceId);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable,
    bool _fixedMaxSupply,
    bool _autoMinting,
    uint256 _tokenPrice,
    address _priceCurrencyFeed,
    bool _useTransferWhitelist,
    bool _useReceiveWhitelist,
    address[] memory _initialTransferWhitelist,
    address[] memory _initialReceiveWhitelist
  ) public initializer {
    __ERC20_init(name, symbol);
    __ERC20Burnable_init();
    __Ownable_init(0x2687fe290b54d824c136Ceff2d5bD362Bc62019a);
    __UUPSUpgradeable_init();

    executor = _executor;
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
    transferHelper = 0x479002F7602579203ffba3eE84ACC1BC5b0d6785;

    // Initialize configuration options
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

    // Set initial transfer whitelist
    for (uint256 i = 0; i < _initialTransferWhitelist.length; i++) {
      canTransfer[_initialTransferWhitelist[i]] = true;
    }

    // Set initial receive whitelist
    for (uint256 i = 0; i < _initialReceiveWhitelist.length; i++) {
      canReceive[_initialReceiveWhitelist[i]] = true;
    }
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function _purchaseConfig() internal pure returns (PurchaseConfig storage cfg) {
    bytes32 slot = _PURCHASE_CONFIG_SLOT;
    assembly {
      cfg.slot := slot
    }
  }

  function _mutualCreditConfig()
    internal
    pure
    returns (MutualCreditConfig storage cfg)
  {
    bytes32 slot = _MUTUAL_CREDIT_CONFIG_SLOT;
    assembly {
      cfg.slot := slot
    }
  }

  function mint(address to, uint256 amount) public virtual {
    require(msg.sender == executor, 'Only executor can mint');
    require(!archived, 'Token is archived');
    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint max supply problemchik blet'
    );

    _mint(to, amount);
  }

  // Override transfer function to respect transferability and whitelists
  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();
    require(!archived, 'Token is archived');
    require(transferable || sender == executor, 'Token transfers are disabled');

    // Executor always bypasses whitelist checks
    if (sender != executor) {
      // Check transfer whitelist (direct or space-based)
      if (useTransferWhitelist) {
        require(
          canTransfer[sender] || _isInTransferWhitelistedSpace(sender),
          'Sender not whitelisted to transfer'
        );
      }
    }

    // Executor can always receive tokens
    if (to != executor) {
      // Check receive whitelist (direct or space-based)
      if (useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }
    }

    // If executor is transferring and auto-minting is enabled, ensure they have enough balance, minting if necessary
    if (sender == executor && autoMinting) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }
    }

    _beforeCreditTransfer(sender, amount);
    _transfer(sender, to, amount);
    _afterCreditTransfer(to, amount);
    return true;
  }

  // Override transferFrom function to respect transferability and whitelists
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = _msgSender();
    require(!archived, 'Token is archived');
    require(
      transferable || spender == executor,
      'Token transfers are disabled'
    );

    // Executor always bypasses whitelist checks
    if (from != executor) {
      // Check transfer whitelist (direct or space-based)
      if (useTransferWhitelist) {
        require(
          canTransfer[from] || _isInTransferWhitelistedSpace(from),
          'Sender not whitelisted to transfer'
        );
      }
    }

    // Executor can always receive tokens
    if (to != executor) {
      // Check receive whitelist (direct or space-based)
      if (useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }
    }

    // If executor is the one being transferred from and auto-minting is enabled, ensure they have enough balance, minting if necessary
    if (from == executor && autoMinting) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    _beforeCreditTransfer(from, amount);

    if (spender == transferHelper) {
      // Skip allowance check for TransferHelper because the helper contract ensures the user's intent.
    } else {
      _spendAllowance(from, spender, amount);
    }
    _transfer(from, to, amount);
    _afterCreditTransfer(to, amount);
    return true;
  }

  /**
   * @dev Update max supply (only if not fixed)
   * @param newMaxSupply The new maximum supply
   */
  function setMaxSupply(uint256 newMaxSupply) external virtual {
    require(msg.sender == executor, 'Only executor can update max supply');
    require(!fixedMaxSupply, 'Max supply is fixed and cannot be changed');
    require(
      newMaxSupply == 0 || newMaxSupply >= totalSupply(),
      'New max supply must be greater than current total supply'
    );

    uint256 oldMaxSupply = maxSupply;
    maxSupply = newMaxSupply;
    emit MaxSupplyUpdated(oldMaxSupply, newMaxSupply);
  }

  /**
   * @dev Update transferable status
   * @param _transferable Whether tokens can be transferred
   */
  function setTransferable(bool _transferable) external virtual {
    require(msg.sender == executor, 'Only executor can update transferable');
    transferable = _transferable;
    emit TransferableUpdated(_transferable);
  }

  /**
   * @dev Update archived status
   * @param _archived Whether token is archived (disables minting and transfers)
   */
  function setArchived(bool _archived) external virtual {
    require(msg.sender == executor, 'Only executor can update archived status');
    archived = _archived;
    emit ArchivedStatusUpdated(_archived);
  }

  /**
   * @dev Returns the name of the token.
   * If a custom name has been set, it overrides the original ERC20 name.
   */
  function name() public view virtual override returns (string memory) {
    if (bytes(_customName).length > 0) {
      return _customName;
    }
    return super.name();
  }

  /**
   * @dev Returns the symbol of the token.
   * If a custom symbol has been set, it overrides the original ERC20 symbol.
   */
  function symbol() public view virtual override returns (string memory) {
    if (bytes(_customSymbol).length > 0) {
      return _customSymbol;
    }
    return super.symbol();
  }

  /**
   * @dev Update the token name
   * @param newName The new token name
   */
  function setTokenName(string memory newName) external virtual {
    require(msg.sender == executor, 'Only executor can update token name');
    require(bytes(newName).length > 0, 'Name cannot be empty');
    string memory oldName = name();
    _customName = newName;
    emit TokenNameUpdated(oldName, newName);
  }

  /**
   * @dev Update the token symbol
   * @param newSymbol The new token symbol
   */
  function setTokenSymbol(string memory newSymbol) external virtual {
    require(msg.sender == executor, 'Only executor can update token symbol');
    require(bytes(newSymbol).length > 0, 'Symbol cannot be empty');
    string memory oldSymbol = symbol();
    _customSymbol = newSymbol;
    emit TokenSymbolUpdated(oldSymbol, newSymbol);
  }

  /**
   * @dev Update auto-minting status
   * @param _autoMinting Whether auto-minting is enabled
   */
  function setAutoMinting(bool _autoMinting) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update auto-minting'
    );
    autoMinting = _autoMinting;
    emit AutoMintingUpdated(_autoMinting);
  }

  /**
   * @dev Update token price in USD
   * @param newPrice The new price in USD (with 6 decimals)
   */
  function setPriceInUSD(uint256 newPrice) external virtual {
    require(msg.sender == executor, 'Only executor can update price');
    uint256 oldPrice = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    emit PriceInUSDUpdated(oldPrice, newPrice);
  }

  /**
   * @dev Update token price and specify which currency it's denominated in.
   * @param newPrice The new price (with 6 decimals)
   * @param currencyFeed Chainlink X/USD feed for the currency (address(0) = USD)
   *
   * Example: token worth 2 CAD → setPriceWithCurrency(2_000_000, cadUsdFeedAddress)
   * Example: token worth 5 USD → setPriceWithCurrency(5_000_000, address(0))
   */
  function setPriceWithCurrency(
    uint256 newPrice,
    address currencyFeed
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update price');
    uint256 oldPrice = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    priceCurrencyFeed = currencyFeed;
    emit PriceInUSDUpdated(oldPrice, newPrice);
    emit PriceCurrencyUpdated(newPrice, currencyFeed);
  }

  function configureTokenPurchase(
    address usdcToken,
    bool enabled,
    uint256 customPrice,
    uint256 maxTokensForSale,
    bool resetSoldCounter
  ) external virtual {
    require(msg.sender == executor, 'Only executor can configure purchases');
    if (enabled) {
      require(usdcToken != address(0), 'USDC token cannot be zero address');
    }

    PurchaseConfig storage cfg = _purchaseConfig();
    cfg.usdcToken = usdcToken;
    cfg.enabled = enabled;
    cfg.customPrice = customPrice;
    cfg.maxTokensForSale = maxTokensForSale;
    if (resetSoldCounter) {
      cfg.soldTokens = 0;
    }

    emit TokenPurchaseConfigUpdated(
      usdcToken,
      enabled,
      customPrice,
      maxTokensForSale,
      resetSoldCounter
    );
  }

  function getTokenPurchaseConfig()
    external
    view
    returns (
      address usdcToken,
      bool enabled,
      uint256 customPrice,
      uint256 effectivePrice,
      uint256 maxTokensForSale,
      uint256 soldTokens,
      uint256 availableToBuy
    )
  {
    PurchaseConfig storage cfg = _purchaseConfig();
    usdcToken = cfg.usdcToken;
    enabled = cfg.enabled;
    customPrice = cfg.customPrice;
    effectivePrice = _effectivePurchasePrice(cfg);
    maxTokensForSale = cfg.maxTokensForSale;
    soldTokens = cfg.soldTokens;
    availableToBuy = getTokensAvailableForPurchaseLimit();
  }

  function getTokensAvailableForPurchaseLimit()
    public
    view
    virtual
    returns (uint256)
  {
    PurchaseConfig storage cfg = _purchaseConfig();
    uint256 campaignRemaining = type(uint256).max;
    if (cfg.maxTokensForSale > 0) {
      if (cfg.soldTokens >= cfg.maxTokensForSale) {
        return 0;
      }
      campaignRemaining = cfg.maxTokensForSale - cfg.soldTokens;
    }

    if (maxSupply == 0) {
      return campaignRemaining;
    }

    uint256 total = totalSupply();
    uint256 unissued = maxSupply > total ? maxSupply - total : 0;
    uint256 treasuryBalance = super.balanceOf(executor);
    uint256 hardLimit = unissued + treasuryBalance;
    return hardLimit < campaignRemaining ? hardLimit : campaignRemaining;
  }

  function quoteUsdcForTokenAmount(
    uint256 tokenAmount
  ) public view virtual returns (uint256) {
    uint256 price = _effectivePurchasePrice(_purchaseConfig());
    require(price > 0, 'Purchase price not configured');
    if (tokenAmount == 0) return 0;
    return ((tokenAmount * price) + (1e18 - 1)) / 1e18;
  }

  function quoteTokenAmountForUsdc(
    uint256 usdcAmount
  ) public view virtual returns (uint256) {
    uint256 price = _effectivePurchasePrice(_purchaseConfig());
    require(price > 0, 'Purchase price not configured');
    if (usdcAmount == 0) return 0;
    return (usdcAmount * 1e18) / price;
  }

  function buyWithUSDC(
    uint256 tokenAmount,
    uint256 maxUsdcAmount,
    address recipient
  ) external virtual returns (uint256 usdcAmount) {
    require(!archived, 'Token is archived');
    require(tokenAmount > 0, 'Token amount must be greater than zero');
    require(recipient != address(0), 'Recipient cannot be zero address');
    require(_canPurchaseRecipient(recipient), 'Recipient not allowed to buy');

    PurchaseConfig storage cfg = _purchaseConfig();
    require(cfg.enabled, 'Token purchase is disabled');
    require(cfg.usdcToken != address(0), 'USDC token is not configured');

    uint256 available = getTokensAvailableForPurchaseLimit();
    require(
      tokenAmount <= available,
      'Requested amount exceeds purchase availability'
    );

    usdcAmount = quoteUsdcForTokenAmount(tokenAmount);
    require(usdcAmount <= maxUsdcAmount, 'USDC amount exceeds max slippage');

    IERC20(cfg.usdcToken).safeTransferFrom(msg.sender, executor, usdcAmount);
    _deliverPurchasedTokens(recipient, tokenAmount);

    cfg.soldTokens = cfg.soldTokens + tokenAmount;

    emit SpaceTokenPurchased(msg.sender, recipient, usdcAmount, tokenAmount);
  }

  function _effectivePurchasePrice(
    PurchaseConfig storage cfg
  ) internal view returns (uint256) {
    if (cfg.customPrice > 0) {
      return cfg.customPrice;
    }
    return tokenPrice;
  }

  function _canPurchaseRecipient(
    address recipient
  ) internal view virtual returns (bool) {
    return canAccountReceive(recipient);
  }

  function _deliverPurchasedTokens(
    address recipient,
    uint256 tokenAmount
  ) internal virtual {
    uint256 treasuryBalance = super.balanceOf(executor);
    uint256 fromTreasury = treasuryBalance < tokenAmount
      ? treasuryBalance
      : tokenAmount;

    if (fromTreasury > 0) {
      _transfer(executor, recipient, fromTreasury);
    }

    uint256 toMint = tokenAmount - fromTreasury;
    if (toMint > 0) {
      require(
        maxSupply == 0 || totalSupply() + toMint <= maxSupply,
        'Exceeds max supply'
      );
      _mintPurchasedTokens(recipient, toMint);
    }

    _afterCreditTransfer(recipient, tokenAmount);
  }

  function _mintPurchasedTokens(
    address recipient,
    uint256 amount
  ) internal virtual {
    _mint(recipient, amount);
  }

  function configureMutualCredit(
    uint256 _defaultCreditLimit,
    uint256[] calldata initialCreditWhitelistSpaceIds,
    bool clearExistingWhitelist,
    bool enabled
  ) external virtual {
    require(msg.sender == executor, 'Only executor can configure mutual credit');

    MutualCreditConfig storage cfg = _mutualCreditConfig();
    cfg.enabled = enabled;
    cfg.defaultCreditLimit = _defaultCreditLimit;

    if (clearExistingWhitelist) {
      uint256[] storage list = cfg.creditWhitelistedSpaceIds;
      while (list.length > 0) {
        uint256 sid = list[list.length - 1];
        cfg.isCreditWhitelistedSpace[sid] = false;
        list.pop();
      }
    }

    for (uint256 i = 0; i < initialCreditWhitelistSpaceIds.length; i++) {
      uint256 sid = initialCreditWhitelistSpaceIds[i];
      if (!cfg.isCreditWhitelistedSpace[sid]) {
        cfg.isCreditWhitelistedSpace[sid] = true;
        cfg.creditWhitelistedSpaceIds.push(sid);
        emit CreditWhitelistSpaceAdded(sid);
      }
    }

    emit MutualCreditConfigured(enabled, _defaultCreditLimit, clearExistingWhitelist);
  }

  function isMutualCreditEnabled() external view returns (bool) {
    return _mutualCreditConfig().enabled;
  }

  function creditBalanceOf(address account) external view returns (uint256) {
    return _mutualCreditConfig().creditBalanceOf[account];
  }

  function creditLimitOf(address account) public view returns (uint256) {
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    if (!cfg.enabled) return 0;
    if (cfg.hasCustomCreditLimit[account]) {
      return cfg.customCreditLimit[account];
    }
    if (_isInCreditWhitelistedSpace(account)) {
      return cfg.defaultCreditLimit;
    }
    return 0;
  }

  function creditLimitLeftOf(address account) public view returns (uint256) {
    uint256 limit = creditLimitOf(account);
    uint256 used = _mutualCreditConfig().creditBalanceOf[account];
    if (used >= limit) return 0;
    return limit - used;
  }

  function netBalanceOf(address account) public view returns (int256) {
    return int256(balanceOf(account)) - int256(_mutualCreditConfig().creditBalanceOf[account]);
  }

  function getCreditWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _mutualCreditConfig().creditWhitelistedSpaceIds;
  }

  function setDefaultCreditLimit(uint256 _limit) external virtual {
    require(msg.sender == executor, 'Only executor can update default credit limit');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    uint256 old = cfg.defaultCreditLimit;
    cfg.defaultCreditLimit = _limit;
    emit DefaultCreditLimitUpdated(old, _limit);
  }

  function setCreditLimit(address member, uint256 limit) external virtual {
    require(msg.sender == executor, 'Only executor can set credit limits');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    cfg.customCreditLimit[member] = limit;
    cfg.hasCustomCreditLimit[member] = true;
    emit CreditLimitSet(member, limit);
  }

  function removeCreditLimit(address member) external virtual {
    require(msg.sender == executor, 'Only executor can remove credit limits');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    delete cfg.customCreditLimit[member];
    cfg.hasCustomCreditLimit[member] = false;
    emit CreditLimitRemoved(member);
  }

  function forgiveCredit(address member, uint256 amount) external virtual {
    require(msg.sender == executor, 'Only executor can forgive credit');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    uint256 debt = cfg.creditBalanceOf[member];
    require(amount <= debt, 'Amount exceeds credit balance');
    cfg.creditBalanceOf[member] = debt - amount;
    emit CreditForgiven(member, amount, cfg.creditBalanceOf[member]);
  }

  function batchAddCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update credit whitelist');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!cfg.isCreditWhitelistedSpace[spaceIds[i]]) {
        cfg.isCreditWhitelistedSpace[spaceIds[i]] = true;
        cfg.creditWhitelistedSpaceIds.push(spaceIds[i]);
        emit CreditWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchRemoveCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update credit whitelist');
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 sid = spaceIds[j];
      if (cfg.isCreditWhitelistedSpace[sid]) {
        cfg.isCreditWhitelistedSpace[sid] = false;
        for (uint256 i = 0; i < cfg.creditWhitelistedSpaceIds.length; i++) {
          if (cfg.creditWhitelistedSpaceIds[i] == sid) {
            cfg.creditWhitelistedSpaceIds[i] = cfg.creditWhitelistedSpaceIds[
              cfg.creditWhitelistedSpaceIds.length - 1
            ];
            cfg.creditWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit CreditWhitelistSpaceRemoved(sid);
      }
    }
  }

  function _beforeCreditTransfer(address from, uint256 amount) internal virtual {
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    if (!cfg.enabled) return;

    uint256 balance = balanceOf(from);
    if (balance >= amount) return;

    uint256 missing = amount - balance;
    uint256 limit = creditLimitOf(from);
    uint256 used = cfg.creditBalanceOf[from];
    require(used + missing <= limit, 'Insufficient credit');

    cfg.creditBalanceOf[from] = used + missing;
    _mint(from, missing);

    emit CreditUsed(from, missing, cfg.creditBalanceOf[from]);
  }

  function _afterCreditTransfer(address to, uint256 amount) internal virtual {
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    if (!cfg.enabled) return;

    uint256 debt = cfg.creditBalanceOf[to];
    if (debt == 0) return;

    uint256 repay = debt < amount ? debt : amount;
    cfg.creditBalanceOf[to] = debt - repay;
    _burn(to, repay);

    emit CreditRepaid(to, repay, cfg.creditBalanceOf[to]);
  }

  function _isInCreditWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    MutualCreditConfig storage cfg = _mutualCreditConfig();
    for (uint256 i = 0; i < cfg.creditWhitelistedSpaceIds.length; i++) {
      uint256 sid = cfg.creditWhitelistedSpaceIds[i];
      if (
        cfg.isCreditWhitelistedSpace[sid] &&
        IDAOSpaceFactory(spacesContract).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev Batch update transfer whitelist
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetTransferWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canTransfer[accounts[i]] = allowed[i];
      emit TransferWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Batch update receive whitelist
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetReceiveWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canReceive[accounts[i]] = allowed[i];
      emit ReceiveWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Enable or disable transfer whitelist enforcement
   * @param enabled Whether to enforce transfer whitelist
   */
  function setUseTransferWhitelist(bool enabled) external virtual {
    require(
      msg.sender == executor,
      'Only executor can update whitelist settings'
    );
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  /**
   * @dev Enable or disable receive whitelist enforcement
   * @param enabled Whether to enforce receive whitelist
   */
  function setUseReceiveWhitelist(bool enabled) external virtual {
    require(
      msg.sender == executor,
      'Only executor can update whitelist settings'
    );
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }

  /**
   * @dev Set the transfer helper address
   * @param _transferHelper The new transfer helper address
   */
  function setTransferHelper(address _transferHelper) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can set transfer helper'
    );
    transferHelper = _transferHelper;
  }

  /**
   * @dev Burn tokens from any address (only executor)
   * @param from The address to burn from
   * @param amount The amount to burn
   */
  function burnFrom(address from, uint256 amount) public virtual override {
    if (msg.sender == executor) {
      // Executor can burn without approval
      _burn(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    } else {
      // Others need approval
      super.burnFrom(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    }
  }

  /**
   * @dev Batch add spaces to transfer whitelist
   * @param spaceIds Array of space IDs to add
   */
  function batchAddTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');

    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isTransferWhitelistedSpace[spaceIds[i]]) {
        isTransferWhitelistedSpace[spaceIds[i]] = true;
        _transferWhitelistedSpaceIds.push(spaceIds[i]);
        emit TransferWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch add spaces to receive whitelist
   * @param spaceIds Array of space IDs to add
   */
  function batchAddReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');

    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isReceiveWhitelistedSpace[spaceIds[i]]) {
        isReceiveWhitelistedSpace[spaceIds[i]] = true;
        _receiveWhitelistedSpaceIds.push(spaceIds[i]);
        emit ReceiveWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch remove spaces from transfer whitelist
   * @param spaceIds Array of space IDs to remove
   */
  function batchRemoveTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');

    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 _spaceId = spaceIds[j];
      if (isTransferWhitelistedSpace[_spaceId]) {
        isTransferWhitelistedSpace[_spaceId] = false;
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < _transferWhitelistedSpaceIds.length; i++) {
          if (_transferWhitelistedSpaceIds[i] == _spaceId) {
            _transferWhitelistedSpaceIds[i] = _transferWhitelistedSpaceIds[
              _transferWhitelistedSpaceIds.length - 1
            ];
            _transferWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit TransferWhitelistSpaceRemoved(_spaceId);
      }
    }
  }

  /**
   * @dev Batch remove spaces from receive whitelist
   * @param spaceIds Array of space IDs to remove
   */
  function batchRemoveReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');

    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 _spaceId = spaceIds[j];
      if (isReceiveWhitelistedSpace[_spaceId]) {
        isReceiveWhitelistedSpace[_spaceId] = false;
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < _receiveWhitelistedSpaceIds.length; i++) {
          if (_receiveWhitelistedSpaceIds[i] == _spaceId) {
            _receiveWhitelistedSpaceIds[i] = _receiveWhitelistedSpaceIds[
              _receiveWhitelistedSpaceIds.length - 1
            ];
            _receiveWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit ReceiveWhitelistSpaceRemoved(_spaceId);
      }
    }
  }

  /**
   * @dev Get all transfer whitelisted space IDs
   * @return Array of space IDs
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
   * @return Array of space IDs
   */
  function getReceiveWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _receiveWhitelistedSpaceIds;
  }

  /**
   * @dev Check if an address is a member of any transfer-whitelisted space
   * @param account The address to check
   * @return True if account is member of any whitelisted space
   */
  function _isInTransferWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < _transferWhitelistedSpaceIds.length; i++) {
      uint256 whitelistedSpaceId = _transferWhitelistedSpaceIds[i];
      if (
        isTransferWhitelistedSpace[whitelistedSpaceId] &&
        IDAOSpaceFactory(spacesContract).isMember(whitelistedSpaceId, account)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev Check if an address is a member of any receive-whitelisted space
   * @param account The address to check
   * @return True if account is member of any whitelisted space
   */
  function _isInReceiveWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < _receiveWhitelistedSpaceIds.length; i++) {
      uint256 whitelistedSpaceId = _receiveWhitelistedSpaceIds[i];
      if (
        isReceiveWhitelistedSpace[whitelistedSpaceId] &&
        IDAOSpaceFactory(spacesContract).isMember(whitelistedSpaceId, account)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @dev Check if an address can transfer tokens (either directly whitelisted or member of whitelisted space)
   * @param account The address to check
   * @return True if account can transfer
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
   * @dev Check if an address can receive tokens (either directly whitelisted or member of whitelisted space)
   * @param account The address to check
   * @return True if account can receive
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
}
