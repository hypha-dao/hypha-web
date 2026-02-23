// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './storage/TokenBackingVaultStorage.sol';
import './interfaces/ITokenBackingVault.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @dev Minimal interface for ERC20 tokens that support burnFrom.
 */
interface ITokenBackingBurnableERC20 {
  function burnFrom(address account, uint256 amount) external;
}

/**
 * @dev Chainlink AggregatorV3Interface (minimal).
 */
interface AggregatorV3Interface {
  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

  function decimals() external view returns (uint8);
}

/**
 * @dev Interface for reading price + currency from Hypha space tokens.
 * Used for BOTH the community token (to get peg value + fiat currency)
 * and Hypha backing tokens (to get their price in some currency).
 *
 * tokenPrice: the price value (6 decimals). Currency specified by priceCurrencyFeed.
 * priceCurrencyFeed: Chainlink X/USD feed for the currency (address(0) = USD).
 *
 * Falls back to priceInUSD() for tokens that haven't been upgraded yet.
 */
interface ISpaceTokenPrice {
  function tokenPrice() external view returns (uint256);

  function priceCurrencyFeed() external view returns (address);
}

/**
 * @title TokenBackingVaultImplementation
 * @dev Fiat-referenced redemption vault for space tokens.
 *
 * The peg value and fiat currency are read directly from the space token
 * contract (tokenPrice + priceCurrencyFeed), NOT stored on the vault.
 * This means changing the token's price automatically changes what
 * redeemers receive — no vault update needed.
 *
 * Two types of backing tokens:
 *   1. Oracle-priced (USDC, EURC, WETH, WBTC) — price from Chainlink feeds
 *   2. Hypha tokens (any RegularSpaceToken) — price from token.tokenPrice()
 *
 * All prices flow through USD as the common denominator:
 *   spaceToken.price (in token's currency) → USD → backing token USD price → amount
 *
 * Setup (single proposal):
 *   addBackingToken(
 *     spaceId, spaceToken,
 *     [usdc, weth, hyphaToken],           // backing tokens
 *     [usdcUsdFeed, ethUsdFeed, addr(0)], // Chainlink feeds (0 = Hypha token)
 *     [6, 18, 18],                        // token decimals
 *     [50_000e6, 10e18, 1000e18],         // funding amounts
 *     2000                                // 20% minimum backing
 *   )
 */
contract TokenBackingVaultImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  TokenBackingVaultStorage,
  ITokenBackingVault
{
  using SafeERC20 for IERC20;

  uint256 public constant BASIS_POINTS = 10000;
  uint256 public constant PRICE_PRECISION = 1e6; // tokenPrice uses 6 decimals
  uint256 public constant PRICE_STALENESS_THRESHOLD = 24 hours;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address initialOwner,
    address _spacesContract
  ) public initializer {
    require(_spacesContract != address(0), 'Invalid spaces contract');
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();
    spacesContract = _spacesContract;
    vaultCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // ============================================================
  //          PRIMARY ENTRY POINT — addBackingToken
  // ============================================================

  /**
   * @dev Add one or more backing tokens, optionally funding each.
   *
   * For oracle-priced tokens: pass the Chainlink feed address.
   * For Hypha tokens: pass address(0) — price is read from token.tokenPrice().
   *
   * The peg value and fiat currency are read from the space token contract
   * (spaceToken.tokenPrice() and spaceToken.priceCurrencyFeed()).
   */
  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    address[] calldata priceFeeds,
    uint8[] calldata tokenDecimals,
    uint256[] calldata fundingAmounts,
    uint256 minimumBackingBps
  ) external nonReentrant returns (uint256 vaultId) {
    _requireExecutorOrOwner(spaceId);

    require(spaceToken != address(0), 'Invalid space token');
    require(backingTokens.length > 0, 'No backing tokens specified');
    require(
      backingTokens.length == priceFeeds.length &&
        backingTokens.length == tokenDecimals.length &&
        backingTokens.length == fundingAmounts.length,
      'Array lengths must match'
    );
    require(
      minimumBackingBps <= BASIS_POINTS,
      'Min backing cannot exceed 100%'
    );

    // Validate the space token has a price set
    uint256 pegPrice = ISpaceTokenPrice(spaceToken).tokenPrice();
    require(pegPrice > 0, 'Space token price must be > 0');

    vaultId = _getOrCreateVault(spaceId, spaceToken, minimumBackingBps);

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];

      require(bt != address(0), 'Invalid backing token');
      require(bt != spaceToken, 'Backing token cannot be the space token');
      require(
        !backingConfigs[vaultId][bt].enabled,
        'Backing token already added'
      );

      // Validate the price source works
      if (priceFeeds[i] != address(0)) {
        _getOraclePrice(priceFeeds[i]);
      } else {
        uint256 hp = ISpaceTokenPrice(bt).tokenPrice();
        require(hp > 0, 'Hypha token price must be > 0');
      }

      backingConfigs[vaultId][bt] = BackingTokenConfig({
        priceFeed: priceFeeds[i],
        tokenDecimals: tokenDecimals[i],
        enabled: true
      });

      backingTokenList[vaultId].push(bt);

      emit BackingTokenAdded(vaultId, bt, priceFeeds[i]);

      if (fundingAmounts[i] > 0) {
        IERC20(bt).safeTransferFrom(
          msg.sender,
          address(this),
          fundingAmounts[i]
        );
        vaultBackingBalance[vaultId][bt] += fundingAmounts[i];

        emit BackingDeposited(vaultId, msg.sender, bt, fundingAmounts[i]);
      }
    }

    return vaultId;
  }

  // ============================================================
  //                    VAULT CONFIGURATION
  // ============================================================

  function removeBackingToken(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(
      backingConfigs[vaultId][backingToken].enabled,
      'Backing token not active'
    );

    backingConfigs[vaultId][backingToken].enabled = false;

    address[] storage list = backingTokenList[vaultId];
    for (uint256 i = 0; i < list.length; i++) {
      if (list[i] == backingToken) {
        list[i] = list[list.length - 1];
        list.pop();
        break;
      }
    }

    emit BackingTokenRemoved(vaultId, backingToken);
  }

  /**
   * @dev Update the Chainlink price feed for an oracle-priced backing token.
   * Cannot be used for Hypha tokens (their price comes from the token contract).
   */
  function updatePriceFeed(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    address newPriceFeed
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    BackingTokenConfig storage config = backingConfigs[vaultId][backingToken];
    require(config.enabled, 'Backing token not active');
    require(config.priceFeed != address(0), 'Cannot set feed for Hypha token');
    require(newPriceFeed != address(0), 'Invalid price feed');

    _getOraclePrice(newPriceFeed);

    address oldFeed = config.priceFeed;
    config.priceFeed = newPriceFeed;

    emit PriceFeedUpdated(vaultId, backingToken, oldFeed, newPriceFeed);
  }

  function setRedeemEnabled(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    vaults[vaultId].redeemEnabled = enabled;
    emit RedeemEnabledUpdated(vaultId, enabled);
  }

  function setMembersOnly(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    vaults[vaultId].membersOnly = enabled;
    emit MembersOnlyUpdated(vaultId, enabled);
  }

  function setWhitelistEnabled(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    vaults[vaultId].whitelistEnabled = enabled;
    emit WhitelistEnabledUpdated(vaultId, enabled);
  }

  function setMinimumBacking(
    uint256 spaceId,
    address spaceToken,
    uint256 minimumBackingBps
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    require(
      minimumBackingBps <= BASIS_POINTS,
      'Min backing cannot exceed 100%'
    );
    vaults[vaultId].minimumBackingBps = minimumBackingBps;
    emit MinimumBackingUpdated(vaultId, minimumBackingBps);
  }

  function setRedemptionStartDate(
    uint256 spaceId,
    address spaceToken,
    uint256 startDate
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    vaults[vaultId].redemptionStartDate = startDate;
    emit RedemptionStartDateUpdated(vaultId, startDate);
  }

  function addToWhitelist(
    uint256 spaceId,
    address spaceToken,
    address[] calldata accounts
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    for (uint256 i = 0; i < accounts.length; i++) {
      whitelist[vaultId][accounts[i]] = true;
    }

    emit WhitelistUpdated(vaultId, accounts, true);
  }

  function removeFromWhitelist(
    uint256 spaceId,
    address spaceToken,
    address[] calldata accounts
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    for (uint256 i = 0; i < accounts.length; i++) {
      whitelist[vaultId][accounts[i]] = false;
    }

    emit WhitelistUpdated(vaultId, accounts, false);
  }

  // ============================================================
  //                    FUNDING (executor only)
  // ============================================================

  /**
   * @dev Deposit additional backing tokens into the vault.
   * Accepts arrays so one or more tokens can be funded in a single call.
   * Caller must have approved this contract for each backing token.
   */
  function addBacking(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    uint256[] calldata amounts
  ) external nonReentrant {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(backingTokens.length > 0, 'No backing tokens specified');
    require(
      backingTokens.length == amounts.length,
      'Array lengths must match'
    );

    for (uint256 i = 0; i < backingTokens.length; i++) {
      require(amounts[i] > 0, 'Amount must be > 0');
      require(
        backingConfigs[vaultId][backingTokens[i]].enabled,
        'Backing token not active'
      );

      IERC20(backingTokens[i]).safeTransferFrom(
        msg.sender,
        address(this),
        amounts[i]
      );
      vaultBackingBalance[vaultId][backingTokens[i]] += amounts[i];

      emit BackingDeposited(
        vaultId,
        msg.sender,
        backingTokens[i],
        amounts[i]
      );
    }
  }

  // ============================================================
  //                    USER REDEMPTION
  // ============================================================

  /**
   * @dev Redeem space tokens for one or more backing tokens in specified proportions.
   * Proportions are in basis points (must sum to 10000).
   * For a single backing token, pass a one-element array with proportion [10000].
   * Peg value and fiat currency are read from the space token contract.
   */
  function redeem(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address[] calldata backingTokens,
    uint256[] calldata proportions
  ) external nonReentrant {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    _requireRedemptionAllowed(vaultId, spaceId);
    require(spaceTokenAmount > 0, 'Amount must be > 0');
    require(backingTokens.length > 0, 'No backing tokens specified');
    require(
      backingTokens.length == proportions.length,
      'Array lengths must match'
    );

    uint256 totalBps = 0;
    for (uint256 i = 0; i < proportions.length; i++) {
      require(proportions[i] > 0, 'Proportion must be > 0');
      totalBps += proportions[i];
    }
    require(totalBps == BASIS_POINTS, 'Proportions must sum to 10000');

    uint256 totalUsdAmount = _spaceTokensToUsd(spaceToken, spaceTokenAmount);

    uint256[] memory backingAmounts = new uint256[](backingTokens.length);
    uint256 totalCoverageRemoved = 0;

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];
      BackingTokenConfig storage btConfig = backingConfigs[vaultId][bt];
      require(btConfig.enabled, 'Backing token not active');

      uint256 usdPortion = (totalUsdAmount * proportions[i]) / BASIS_POINTS;

      uint256 backingOut = _calculateBackingOut(usdPortion, bt, btConfig);
      require(backingOut > 0, 'Output amount too small');
      require(
        vaultBackingBalance[vaultId][bt] >= backingOut,
        'Insufficient backing in reserve'
      );

      totalCoverageRemoved += _tokenCoverageUsd(backingOut, bt, btConfig);

      backingAmounts[i] = backingOut;
    }

    _checkMinimumBacking(
      vaultId,
      spaceToken,
      spaceTokenAmount,
      totalCoverageRemoved
    );

    ITokenBackingBurnableERC20(spaceToken).burnFrom(
      msg.sender,
      spaceTokenAmount
    );

    for (uint256 i = 0; i < backingTokens.length; i++) {
      vaultBackingBalance[vaultId][backingTokens[i]] -= backingAmounts[i];
      IERC20(backingTokens[i]).safeTransfer(msg.sender, backingAmounts[i]);
    }

    emit Redeemed(
      vaultId,
      msg.sender,
      spaceTokenAmount,
      backingTokens,
      backingAmounts
    );
  }

  // ============================================================
  //                  EXECUTOR-ONLY WITHDRAWALS
  // ============================================================

  function withdrawBacking(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 amount
  ) external nonReentrant {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(amount > 0, 'Amount must be > 0');
    require(
      vaultBackingBalance[vaultId][backingToken] >= amount,
      'Insufficient backing balance'
    );

    vaultBackingBalance[vaultId][backingToken] -= amount;
    IERC20(backingToken).safeTransfer(msg.sender, amount);

    emit BackingWithdrawn(vaultId, backingToken, amount);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(_spacesContract != address(0), 'Invalid spaces contract');
    spacesContract = _spacesContract;
  }

  // ============================================================
  //                      VIEW FUNCTIONS
  // ============================================================

  function getVaultConfig(
    uint256 spaceId,
    address spaceToken
  ) external view returns (VaultConfig memory) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    return vaults[vaultId];
  }

  function getBackingTokens(
    uint256 spaceId,
    address spaceToken
  ) external view returns (address[] memory) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    return backingTokenList[vaultId];
  }

  function getBackingTokenConfig(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external view returns (BackingTokenConfig memory) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    return backingConfigs[vaultId][backingToken];
  }

  function getBackingBalance(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external view returns (uint256) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    return vaultBackingBalance[vaultId][backingToken];
  }

  function calculateBackingOut(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address backingToken
  ) external view returns (uint256) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    BackingTokenConfig storage btConfig = backingConfigs[vaultId][backingToken];
    require(btConfig.enabled, 'Backing token not active');
    uint256 usdAmount = _spaceTokensToUsd(spaceToken, spaceTokenAmount);
    return _calculateBackingOut(usdAmount, backingToken, btConfig);
  }

  function vaultExists(
    uint256 spaceId,
    address spaceToken
  ) external view returns (bool) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    return vaultKeys[key] != 0;
  }

  function getSpaceVaults(
    uint256 spaceId
  ) external view returns (uint256[] memory) {
    return spaceVaultIds[spaceId];
  }

  function isWhitelisted(
    uint256 spaceId,
    address spaceToken,
    address account
  ) external view returns (bool) {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    return whitelist[vaultId][account];
  }

  // ============================================================
  //                     INTERNAL HELPERS
  // ============================================================

  function _getOrCreateVault(
    uint256 spaceId,
    address spaceToken,
    uint256 minimumBackingBps
  ) internal returns (uint256 vaultId) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    vaultId = vaultKeys[key];

    if (vaultId == 0) {
      vaultCounter++;
      vaultId = vaultCounter;

      vaults[vaultId] = VaultConfig({
        spaceId: spaceId,
        spaceToken: spaceToken,
        redeemEnabled: true,
        membersOnly: false,
        whitelistEnabled: false,
        minimumBackingBps: minimumBackingBps,
        redemptionStartDate: 0
      });

      vaultKeys[key] = vaultId;
      spaceVaultIds[spaceId].push(vaultId);

      emit VaultCreated(vaultId, spaceId, spaceToken);

      if (minimumBackingBps > 0) {
        emit MinimumBackingUpdated(vaultId, minimumBackingBps);
      }
    }
  }

  function _requireVault(
    uint256 spaceId,
    address spaceToken
  ) internal view returns (uint256 vaultId) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    vaultId = vaultKeys[key];
    require(vaultId != 0, 'Vault does not exist');
  }

  function _requireRedemptionAllowed(
    uint256 vaultId,
    uint256 spaceId
  ) internal view {
    VaultConfig storage config = vaults[vaultId];

    require(config.redeemEnabled, 'Redemptions are disabled');

    if (config.redemptionStartDate > 0) {
      require(
        block.timestamp >= config.redemptionStartDate,
        'Redemptions not yet active'
      );
    }

    if (config.membersOnly || config.whitelistEnabled) {
      bool isMember = config.membersOnly &&
        IDAOSpaceFactory(spacesContract).isMember(spaceId, msg.sender);
      bool isWl = config.whitelistEnabled && whitelist[vaultId][msg.sender];

      require(isMember || isWl, 'Not authorized to redeem');
    }
  }

  // ── Space token peg helpers ──

  /**
   * @dev Convert space token amount to USD value (1e18 precision).
   * Reads tokenPrice() and priceCurrencyFeed() from the space token.
   *
   * Example: 100 tokens, price = 2 EUR, EUR/USD = 1.08
   *   → 100e18 * 2e6 / 1e6 = 200e18 (in EUR × 1e18)
   *   → 200e18 * 1.08e8 / 1e8 = 216e18 (in USD × 1e18)
   */
  function _spaceTokensToUsd(
    address spaceToken,
    uint256 spaceTokenAmount
  ) internal view returns (uint256) {
    uint256 priceInUsd = _getHyphaTokenPriceInUsd(spaceToken);
    require(priceInUsd > 0, 'Space token price is 0');

    // spaceTokenAmount (1e18) * priceInUsd (6 dec) / PRICE_PRECISION (1e6) = USD value (1e18)
    return (spaceTokenAmount * priceInUsd) / PRICE_PRECISION;
  }

  // ── Oracle helpers ──

  function _getOraclePrice(
    address feed
  ) internal view returns (uint256 price, uint8 feedDecimals) {
    (, int256 answer, , uint256 updatedAt, ) = AggregatorV3Interface(feed)
      .latestRoundData();
    require(answer > 0, 'Invalid oracle price');
    require(
      updatedAt >= block.timestamp - PRICE_STALENESS_THRESHOLD,
      'Stale oracle price'
    );
    price = uint256(answer);
    feedDecimals = AggregatorV3Interface(feed).decimals();
  }

  /**
   * @dev Get a Hypha token's price in USD (6 decimals).
   * Reads tokenPrice() and priceCurrencyFeed() from the token contract.
   * If priceCurrencyFeed is address(0), the price is already in USD.
   * Otherwise, converts: priceInUsd = price × currencyToUsdRate / 10^feedDec
   */
  function _getHyphaTokenPriceInUsd(
    address token
  ) internal view returns (uint256) {
    uint256 rawPrice = ISpaceTokenPrice(token).tokenPrice();
    address currencyFeed = ISpaceTokenPrice(token).priceCurrencyFeed();

    if (currencyFeed == address(0)) {
      return rawPrice; // Already in USD
    }

    (uint256 currencyRate, uint8 feedDec) = _getOraclePrice(currencyFeed);
    return (rawPrice * currencyRate) / (10 ** feedDec);
  }

  // ── Backing-out calculation ──

  /**
   * @dev Calculate how many backing tokens a user receives for a given USD amount.
   * All amounts flow through USD as the common denominator.
   *
   * @param usdAmount USD value in 1e18 precision
   */
  function _calculateBackingOut(
    uint256 usdAmount,
    address backingToken,
    BackingTokenConfig storage config
  ) internal view returns (uint256) {
    if (config.priceFeed != address(0)) {
      return
        _calculateOracleBackingOut(
          usdAmount,
          config.priceFeed,
          config.tokenDecimals
        );
    } else {
      return
        _calculateHyphaBackingOut(
          usdAmount,
          backingToken,
          config.tokenDecimals
        );
    }
  }

  /**
   * @dev Oracle path: backingOut = usdAmount × 10^tokenDec / (backingPriceUsd × 1e18)
   * Adjusted for Chainlink feed decimals.
   */
  function _calculateOracleBackingOut(
    uint256 usdAmount,
    address backingPriceFeed,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);

    // backingOut = usdAmount * 10^tokenDec / (backingPrice * 1e18 / 10^bpDec)
    //           = usdAmount * 10^tokenDec * 10^bpDec / (backingPrice * 1e18)
    return
      (usdAmount * (10 ** backingTokenDecimals) * (10 ** bpDec)) /
      (backingPrice * 1e18);
  }

  /**
   * @dev Hypha path: backingOut = usdAmount × PRICE_PRECISION × 10^tokenDec / (priceInUsd × 1e18)
   */
  function _calculateHyphaBackingOut(
    uint256 usdAmount,
    address backingToken,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    uint256 priceInUsd = _getHyphaTokenPriceInUsd(backingToken);
    require(priceInUsd > 0, 'Hypha token price is 0');

    return
      (usdAmount * PRICE_PRECISION * (10 ** backingTokenDecimals)) /
      (priceInUsd * 1e18);
  }

  // ── Coverage calculation (all in USD) ──

  /**
   * @dev USD value (× 1e18) of a backing token amount.
   */
  function _tokenCoverageUsd(
    uint256 balance,
    address backingToken,
    BackingTokenConfig storage config
  ) internal view returns (uint256) {
    if (balance == 0) return 0;

    if (config.priceFeed != address(0)) {
      return
        _oracleCoverageUsd(balance, config.priceFeed, config.tokenDecimals);
    } else {
      return _hyphaCoverageUsd(balance, backingToken, config.tokenDecimals);
    }
  }

  /**
   * @dev Oracle coverage in USD: balance × backingPrice / (10^tokenDec × 10^feedDec) × 1e18
   */
  function _oracleCoverageUsd(
    uint256 balance,
    address backingPriceFeed,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);

    return
      (balance * backingPrice * 1e18) /
      ((10 ** backingTokenDecimals) * (10 ** bpDec));
  }

  /**
   * @dev Hypha coverage in USD: balance × priceInUsd / (10^tokenDec × PRICE_PRECISION) × 1e18
   */
  function _hyphaCoverageUsd(
    uint256 balance,
    address backingToken,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    uint256 priceInUsd = _getHyphaTokenPriceInUsd(backingToken);
    if (priceInUsd == 0) return 0;

    return
      (balance * priceInUsd * 1e18) /
      ((10 ** backingTokenDecimals) * PRICE_PRECISION);
  }

  // ── Minimum backing check ──

  /**
   * @dev Aggregate check: remaining USD coverage must be >= minBps % of remaining USD liability.
   * USD liability = remainingSupply × spaceTokenPriceInUsd / PRICE_PRECISION.
   */
  function _checkMinimumBacking(
    uint256 vaultId,
    address spaceToken,
    uint256 spaceTokensBurned,
    uint256 coverageRemovedUsd
  ) internal view {
    uint256 minBps = vaults[vaultId].minimumBackingBps;
    if (minBps == 0) return;

    uint256 currentSupply = IERC20(spaceToken).totalSupply();
    uint256 remainingSupply = currentSupply - spaceTokensBurned;

    if (remainingSupply == 0) return;

    uint256 totalCoverageUsd = _computeTotalCoverageUsd(vaultId);
    uint256 remainingCoverageUsd = totalCoverageUsd - coverageRemovedUsd;

    // Remaining USD liability = remainingSupply × priceInUsd / PRICE_PRECISION
    uint256 priceInUsd = _getHyphaTokenPriceInUsd(spaceToken);
    uint256 remainingLiabilityUsd = (remainingSupply * priceInUsd) /
      PRICE_PRECISION;

    // remainingCoverageUsd × BASIS_POINTS >= remainingLiabilityUsd × minBps
    require(
      remainingCoverageUsd * BASIS_POINTS >= remainingLiabilityUsd * minBps,
      'Redemption would breach minimum backing threshold'
    );
  }

  function _computeTotalCoverageUsd(
    uint256 vaultId
  ) internal view returns (uint256 totalCoverage) {
    address[] storage tokens = backingTokenList[vaultId];

    for (uint256 i = 0; i < tokens.length; i++) {
      address bt = tokens[i];
      uint256 balance = vaultBackingBalance[vaultId][bt];
      if (balance > 0) {
        BackingTokenConfig storage btConfig = backingConfigs[vaultId][bt];
        totalCoverage += _tokenCoverageUsd(balance, bt, btConfig);
      }
    }
  }

  // ── Common helpers ──

  function _getVaultKey(
    uint256 spaceId,
    address spaceToken
  ) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(spaceId, spaceToken));
  }

  function _requireExecutorOrOwner(uint256 spaceId) internal view {
    address executor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == executor || msg.sender == owner(),
      'Not authorized: only executor or owner'
    );
  }
}
