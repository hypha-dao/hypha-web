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
 * @dev Interface for reading price from Hypha space tokens (RegularSpaceToken, etc.).
 * The priceInUSD field is a general-purpose price (6 decimals).
 * For Token Backing Vault, it represents the token's price in the vault's fiat currency.
 */
interface ISpaceTokenPrice {
  function priceInUSD() external view returns (uint256);
}

/**
 * @title TokenBackingVaultImplementation
 * @dev Fiat-referenced redemption vault for space tokens. Each community token
 * has a configurable peg value in a chosen fiat currency.
 *
 * Two types of backing tokens:
 *   1. Oracle-priced (USDC, EURC, WETH, WBTC) — price from Chainlink feeds
 *   2. Hypha tokens (any RegularSpaceToken) — price from token.priceInUSD()
 *
 * Key features:
 *   - Configurable peg: 1 token = X fiat units (not limited to 1:1)
 *   - Oracle pricing for external assets (Chainlink)
 *   - On-chain pricing for Hypha tokens (from the token contract)
 *   - Any Hypha token can be used as backing alongside oracle-priced tokens
 *   - Whitelist + membership access control (OR logic)
 *   - Configurable redemption start date
 *   - Aggregate minimum backing threshold
 *
 * Setup (single proposal):
 *   addBackingToken(
 *     spaceId, spaceToken,
 *     [usdc, weth, hyphaToken],         // backing tokens
 *     [usdcUsdFeed, ethUsdFeed, addr(0)], // Chainlink feeds (0 = Hypha token)
 *     [6, 18, 18],                       // token decimals
 *     [50_000e6, 10e18, 1000e18],        // funding amounts
 *     address(0),                        // USD peg
 *     2_000_000,                         // 1 token = 2 USD (6 decimals)
 *     2000                               // 20% minimum backing
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
  uint256 public constant PEG_PRECISION = 1e6; // pegValue uses 6 decimals
  uint256 public constant HYPHA_PRICE_PRECISION = 1e6; // priceInUSD uses 6 decimals
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
   * For oracle-priced tokens (USDC, EURC, WETH, WBTC): pass the Chainlink feed address.
   * For Hypha tokens: pass address(0) as the price feed — price is read from token.priceInUSD().
   *
   * @param backingTokens The reserve tokens
   * @param priceFeeds Chainlink feed per token; address(0) = Hypha token
   * @param tokenDecimals Decimals per token
   * @param fundingAmounts Deposit per token (0 = skip)
   * @param fiatPriceFeed Chainlink fiat/USD feed; address(0) = USD peg
   * @param pegValue Fiat value of 1 community token (6 decimals)
   * @param minimumBackingBps Minimum backing % (only on vault creation)
   */
  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    address[] calldata priceFeeds,
    uint8[] calldata tokenDecimals,
    uint256[] calldata fundingAmounts,
    address fiatPriceFeed,
    uint256 pegValue,
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
    require(pegValue > 0, 'Peg value must be > 0');
    require(
      minimumBackingBps <= BASIS_POINTS,
      'Min backing cannot exceed 100%'
    );

    vaultId = _getOrCreateVault(
      spaceId,
      spaceToken,
      fiatPriceFeed,
      pegValue,
      minimumBackingBps
    );

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
        uint256 hp = ISpaceTokenPrice(bt).priceInUSD();
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

  /**
   * @dev Update the peg value (fiat value of 1 community token, 6 decimals).
   */
  function setPegValue(
    uint256 spaceId,
    address spaceToken,
    uint256 pegValue
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    require(pegValue > 0, 'Peg value must be > 0');
    vaults[vaultId].pegValue = pegValue;
    emit PegValueUpdated(vaultId, pegValue);
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

  function addBacking(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 amount
  ) external nonReentrant {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(amount > 0, 'Amount must be > 0');
    require(
      backingConfigs[vaultId][backingToken].enabled,
      'Backing token not active'
    );

    IERC20(backingToken).safeTransferFrom(msg.sender, address(this), amount);
    vaultBackingBalance[vaultId][backingToken] += amount;

    emit BackingDeposited(vaultId, msg.sender, backingToken, amount);
  }

  // ============================================================
  //                    USER REDEMPTION
  // ============================================================

  /**
   * @dev Redeem space tokens for a single backing token.
   * The user receives backing tokens worth (spaceTokenAmount × pegValue) in fiat.
   */
  function redeem(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address backingToken
  ) external nonReentrant {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    _requireRedemptionAllowed(vaultId, spaceId);
    require(spaceTokenAmount > 0, 'Amount must be > 0');

    VaultConfig storage vault = vaults[vaultId];
    BackingTokenConfig storage btConfig = backingConfigs[vaultId][backingToken];
    require(btConfig.enabled, 'Backing token not active');

    // Convert space tokens to fiat value: fiatAmount = spaceTokenAmount * pegValue / PEG_PRECISION
    uint256 fiatAmount = (spaceTokenAmount * vault.pegValue) / PEG_PRECISION;

    uint256 backingOut = _calculateBackingOut(
      fiatAmount,
      backingToken,
      btConfig,
      vault.fiatPriceFeed
    );
    require(backingOut > 0, 'Output amount too small');
    require(
      vaultBackingBalance[vaultId][backingToken] >= backingOut,
      'Insufficient backing in reserve'
    );

    // Check aggregate minimum backing
    uint256 coverageRemoved = _tokenCoverage(
      backingOut,
      backingToken,
      btConfig,
      vault.fiatPriceFeed
    );
    _checkMinimumBacking(vaultId, spaceToken, spaceTokenAmount, coverageRemoved);

    // Burn the user's space tokens
    ITokenBackingBurnableERC20(spaceToken).burnFrom(
      msg.sender,
      spaceTokenAmount
    );

    // Send backing tokens to user
    vaultBackingBalance[vaultId][backingToken] -= backingOut;
    IERC20(backingToken).safeTransfer(msg.sender, backingOut);

    emit Redeemed(
      vaultId,
      msg.sender,
      spaceTokenAmount,
      backingToken,
      backingOut
    );
  }

  /**
   * @dev Redeem space tokens for multiple backing tokens in specified proportions.
   * Proportions are in basis points (out of 10000).
   */
  function redeemMulti(
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

    VaultConfig storage vault = vaults[vaultId];

    // Total fiat value = spaceTokenAmount * pegValue / PEG_PRECISION
    uint256 totalFiatAmount = (spaceTokenAmount * vault.pegValue) /
      PEG_PRECISION;

    uint256[] memory backingAmounts = new uint256[](backingTokens.length);
    uint256 totalCoverageRemoved = 0;

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];
      BackingTokenConfig storage btConfig = backingConfigs[vaultId][bt];
      require(btConfig.enabled, 'Backing token not active');

      uint256 fiatPortion = (totalFiatAmount * proportions[i]) / BASIS_POINTS;

      uint256 backingOut = _calculateBackingOut(
        fiatPortion,
        bt,
        btConfig,
        vault.fiatPriceFeed
      );
      require(backingOut > 0, 'Output amount too small');
      require(
        vaultBackingBalance[vaultId][bt] >= backingOut,
        'Insufficient backing in reserve'
      );

      totalCoverageRemoved += _tokenCoverage(
        backingOut,
        bt,
        btConfig,
        vault.fiatPriceFeed
      );

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

    emit RedeemedMulti(
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
    uint256 fiatAmount = (spaceTokenAmount * vaults[vaultId].pegValue) /
      PEG_PRECISION;
    return
      _calculateBackingOut(
        fiatAmount,
        backingToken,
        btConfig,
        vaults[vaultId].fiatPriceFeed
      );
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
    address fiatPriceFeed,
    uint256 pegValue,
    uint256 minimumBackingBps
  ) internal returns (uint256 vaultId) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    vaultId = vaultKeys[key];

    if (vaultId == 0) {
      if (fiatPriceFeed != address(0)) {
        _getOraclePrice(fiatPriceFeed);
      }

      vaultCounter++;
      vaultId = vaultCounter;

      vaults[vaultId] = VaultConfig({
        spaceId: spaceId,
        spaceToken: spaceToken,
        redeemEnabled: true,
        membersOnly: false,
        whitelistEnabled: false,
        minimumBackingBps: minimumBackingBps,
        redemptionStartDate: 0,
        fiatPriceFeed: fiatPriceFeed,
        pegValue: pegValue
      });

      vaultKeys[key] = vaultId;
      spaceVaultIds[spaceId].push(vaultId);

      emit VaultCreated(vaultId, spaceId, spaceToken, fiatPriceFeed, pegValue);

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

  /**
   * @dev Validate redemption prerequisites: enabled, date, membership/whitelist (OR logic).
   */
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

  // ── Price helpers ──

  /**
   * @dev Read a Chainlink price feed. Reverts if stale or invalid.
   */
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

  function _getFiatPrice(
    address fiatPriceFeed
  ) internal view returns (uint256 price, uint8 feedDecimals) {
    if (fiatPriceFeed == address(0)) {
      return (1e8, 8); // 1 USD = 1 USD
    }
    return _getOraclePrice(fiatPriceFeed);
  }

  // ── Backing-out calculation ──

  /**
   * @dev Calculate how many backing tokens a user receives for a given fiat amount.
   * Dispatches to oracle or Hypha pricing based on the config.
   *
   * @param fiatAmount Fiat value in 1e18 precision (spaceTokenAmount * pegValue / PEG_PRECISION)
   */
  function _calculateBackingOut(
    uint256 fiatAmount,
    address backingToken,
    BackingTokenConfig storage config,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    if (config.priceFeed != address(0)) {
      return
        _calculateOracleBackingOut(
          fiatAmount,
          config.priceFeed,
          config.tokenDecimals,
          fiatPriceFeed
        );
    } else {
      return
        _calculateHyphaBackingOut(
          fiatAmount,
          backingToken,
          config.tokenDecimals
        );
    }
  }

  /**
   * @dev Oracle path: backingOut = fiatAmount × (fiatPrice / backingPrice) × 10^tokenDec / 1e18
   */
  function _calculateOracleBackingOut(
    uint256 fiatAmount,
    address backingPriceFeed,
    uint8 backingTokenDecimals,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);
    (uint256 fiatPrice, uint8 fpDec) = _getFiatPrice(fiatPriceFeed);

    uint256 numerator = fiatAmount * fiatPrice;
    uint256 denominator = backingPrice * 1e18;

    if (bpDec > fpDec) {
      numerator *= 10 ** (bpDec - fpDec);
    } else if (fpDec > bpDec) {
      denominator *= 10 ** (fpDec - bpDec);
    }

    return (numerator * (10 ** backingTokenDecimals)) / denominator;
  }

  /**
   * @dev Hypha path: price from token.priceInUSD() (6 decimals, in vault's fiat currency).
   * backingOut = fiatAmount × HYPHA_PRICE_PRECISION × 10^tokenDec / (hyphaPrice × 1e18)
   */
  function _calculateHyphaBackingOut(
    uint256 fiatAmount,
    address backingToken,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    uint256 hyphaPrice = ISpaceTokenPrice(backingToken).priceInUSD();
    require(hyphaPrice > 0, 'Hypha token price is 0');

    return
      (fiatAmount * HYPHA_PRICE_PRECISION * (10 ** backingTokenDecimals)) /
      (hyphaPrice * 1e18);
  }

  // ── Coverage calculation ──

  /**
   * @dev Fiat value (× 1e18) of a backing token amount. Dispatches based on price source.
   */
  function _tokenCoverage(
    uint256 balance,
    address backingToken,
    BackingTokenConfig storage config,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    if (balance == 0) return 0;

    if (config.priceFeed != address(0)) {
      return
        _oracleCoverage(
          balance,
          config.priceFeed,
          config.tokenDecimals,
          fiatPriceFeed
        );
    } else {
      return _hyphaCoverage(balance, backingToken, config.tokenDecimals);
    }
  }

  /**
   * @dev Oracle coverage: fiatValue = balance × backingPrice / (10^tokenDec × fiatPrice)
   * Returns fiat value × 1e18.
   */
  function _oracleCoverage(
    uint256 balance,
    address backingPriceFeed,
    uint8 backingTokenDecimals,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);
    (uint256 fiatPrice, uint8 fpDec) = _getFiatPrice(fiatPriceFeed);

    uint256 numerator = balance * backingPrice;
    uint256 denominator = (10 ** backingTokenDecimals) * fiatPrice;

    if (fpDec > bpDec) {
      numerator *= 10 ** (fpDec - bpDec);
    } else if (bpDec > fpDec) {
      denominator *= 10 ** (bpDec - fpDec);
    }

    return (numerator * 1e18) / denominator;
  }

  /**
   * @dev Hypha coverage: fiatValue = balance × hyphaPrice / (10^tokenDec × HYPHA_PRICE_PRECISION)
   * Returns fiat value × 1e18.
   */
  function _hyphaCoverage(
    uint256 balance,
    address backingToken,
    uint8 backingTokenDecimals
  ) internal view returns (uint256) {
    uint256 hyphaPrice = ISpaceTokenPrice(backingToken).priceInUSD();
    if (hyphaPrice == 0) return 0;

    return
      (balance * hyphaPrice * 1e18) /
      ((10 ** backingTokenDecimals) * HYPHA_PRICE_PRECISION);
  }

  // ── Minimum backing check ──

  /**
   * @dev Aggregate check: remaining fiat coverage must be >= minBps % of remaining fiat liability.
   * Fiat liability = remainingSupply × pegValue / PEG_PRECISION.
   */
  function _checkMinimumBacking(
    uint256 vaultId,
    address spaceToken,
    uint256 spaceTokensBurned,
    uint256 coverageRemoved
  ) internal view {
    uint256 minBps = vaults[vaultId].minimumBackingBps;
    if (minBps == 0) return;

    uint256 currentSupply = IERC20(spaceToken).totalSupply();
    uint256 remainingSupply = currentSupply - spaceTokensBurned;

    if (remainingSupply == 0) return;

    uint256 totalCoverage = _computeTotalCoverage(vaultId);
    uint256 remainingCoverage = totalCoverage - coverageRemoved;

    uint256 pegValue = vaults[vaultId].pegValue;

    // remainingCoverage (fiat × 1e18) × PEG_PRECISION × BASIS_POINTS
    //   >= remainingSupply (1e18) × pegValue (1e6) × minBps
    require(
      remainingCoverage * PEG_PRECISION * BASIS_POINTS >=
        remainingSupply * pegValue * minBps,
      'Redemption would breach minimum backing threshold'
    );
  }

  function _computeTotalCoverage(
    uint256 vaultId
  ) internal view returns (uint256 totalCoverage) {
    address fiatFeed = vaults[vaultId].fiatPriceFeed;
    address[] storage tokens = backingTokenList[vaultId];

    for (uint256 i = 0; i < tokens.length; i++) {
      address bt = tokens[i];
      uint256 balance = vaultBackingBalance[vaultId][bt];
      if (balance > 0) {
        BackingTokenConfig storage btConfig = backingConfigs[vaultId][bt];
        totalCoverage += _tokenCoverage(balance, bt, btConfig, fiatFeed);
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

