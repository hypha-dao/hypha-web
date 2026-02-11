// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './storage/PeggedVaultStorage.sol';
import './interfaces/IPeggedVault.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @dev Minimal interface for ERC20 tokens that support burnFrom.
 */
interface IPeggedBurnableERC20 {
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
 * @title PeggedVaultImplementation
 * @dev Fiat-pegged redemption vault for space tokens. Each community token is
 * pegged 1:1 to a chosen fiat currency (USD, EUR, JPY, etc.).
 *
 * Unlike BackingVault (fixed exchange rates), this vault uses Chainlink price
 * feeds to determine how many backing tokens a user receives at redemption time.
 *
 * Supported backing tokens: USDC, EURC, WETH, WBTC (max 4 per vault).
 * Redeemed community tokens are permanently burned, reducing total supply.
 *
 * Key differences from BackingVault:
 *   - 1 community token = 1 fiat unit (always, determined by oracle)
 *   - Exchange rates come from Chainlink oracles, not admin-set values
 *   - Max 4 backing tokens per vault (USDC, EURC, WETH, WBTC)
 *   - Whitelist support for access-controlled redemptions
 *   - Configurable redemption start date
 *
 * Setup (single proposal):
 *   addBackingToken(
 *     spaceId, spaceToken,
 *     [usdc, weth],                    // backing tokens
 *     [usdcUsdFeed, ethUsdFeed],       // Chainlink price feeds
 *     [6, 18],                         // token decimals
 *     [50_000e6, 10e18],               // funding amounts
 *     address(0),                      // USD peg (or EUR/USD feed for EUR peg)
 *     2000                             // 20% minimum backing
 *   )
 */
contract PeggedVaultImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  PeggedVaultStorage,
  IPeggedVault
{
  using SafeERC20 for IERC20;

  uint256 public constant BASIS_POINTS = 10000;
  uint256 public constant MAX_BACKING_TOKENS = 4;
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
  //     Auto-creates the vault on first call for a space token
  // ============================================================

  /**
   * @dev Add one or more backing tokens with Chainlink price feeds, optionally
   * funding the reserve for each in the same transaction.
   *
   * If no vault exists yet, it is auto-created with the given fiat peg and minimum backing.
   * Max 4 backing tokens per vault (USDC, EURC, WETH, WBTC).
   *
   * @param spaceId The space this token belongs to
   * @param spaceToken The community/space token users will burn to redeem
   * @param backingTokens The reserve tokens (USDC, EURC, WETH, WBTC)
   * @param priceFeeds Chainlink price feed per backing token (e.g., ETH/USD)
   * @param tokenDecimals Decimals per backing token (6, 18, 8, etc.)
   * @param fundingAmounts Amount of each backing token to deposit (0 = skip)
   * @param fiatPriceFeed Chainlink fiat/USD feed; address(0) = USD peg
   * @param minimumBackingBps Minimum backing % in basis points (only on vault creation)
   * @return vaultId The internal vault ID
   */
  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    address[] calldata priceFeeds,
    uint8[] calldata tokenDecimals,
    uint256[] calldata fundingAmounts,
    address fiatPriceFeed,
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

    // Auto-create vault if it doesn't exist
    vaultId = _getOrCreateVault(
      spaceId,
      spaceToken,
      fiatPriceFeed,
      minimumBackingBps
    );

    // Enforce max backing tokens
    require(
      backingTokenList[vaultId].length + backingTokens.length <=
        MAX_BACKING_TOKENS,
      'Exceeds max 4 backing tokens'
    );

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];

      require(bt != address(0), 'Invalid backing token');
      require(bt != spaceToken, 'Backing token cannot be the space token');
      require(priceFeeds[i] != address(0), 'Invalid price feed');
      require(
        !backingConfigs[vaultId][bt].enabled,
        'Backing token already added'
      );

      // Validate the price feed works
      _getOraclePrice(priceFeeds[i]);

      backingConfigs[vaultId][bt] = BackingTokenConfig({
        priceFeed: priceFeeds[i],
        tokenDecimals: tokenDecimals[i],
        enabled: true
      });

      backingTokenList[vaultId].push(bt);

      emit BackingTokenAdded(vaultId, bt, priceFeeds[i]);

      // Optionally fund the reserve
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

  function updatePriceFeed(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    address newPriceFeed
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(
      backingConfigs[vaultId][backingToken].enabled,
      'Backing token not active'
    );
    require(newPriceFeed != address(0), 'Invalid price feed');

    // Validate the new feed works
    _getOraclePrice(newPriceFeed);

    address oldFeed = backingConfigs[vaultId][backingToken].priceFeed;
    backingConfigs[vaultId][backingToken].priceFeed = newPriceFeed;

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

  /**
   * @dev Update the minimum backing threshold (basis points, 0-10000).
   * When set > 0, redemptions are blocked if aggregate coverage falls below
   * this % of remaining supply.
   */
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

  /**
   * @dev Set the date from which redemptions are allowed.
   * Pass 0 to remove the date restriction.
   */
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

  /**
   * @dev Add addresses to the redemption whitelist.
   */
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

  /**
   * @dev Remove addresses from the redemption whitelist.
   */
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
   * @dev Add backing tokens to the vault reserve.
   * Only the space executor or contract owner can call this.
   */
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
   * @dev Redeem space tokens for a single backing token at the oracle rate.
   * 1 community token = 1 fiat unit worth of backing token.
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

    BackingTokenConfig storage btConfig = backingConfigs[vaultId][backingToken];
    require(btConfig.enabled, 'Backing token not active');

    uint256 backingOut = _calculateBackingOut(
      spaceTokenAmount,
      btConfig.priceFeed,
      btConfig.tokenDecimals,
      vaults[vaultId].fiatPriceFeed
    );
    require(backingOut > 0, 'Output amount too small');
    require(
      vaultBackingBalance[vaultId][backingToken] >= backingOut,
      'Insufficient backing in reserve'
    );

    // Check aggregate minimum backing threshold
    uint256 coverageRemoved = _tokenCoverage(
      backingOut,
      btConfig.priceFeed,
      btConfig.tokenDecimals,
      vaults[vaultId].fiatPriceFeed
    );
    _checkMinimumBacking(
      vaultId,
      spaceToken,
      spaceTokenAmount,
      coverageRemoved
    );

    // Burn the user's space tokens
    IPeggedBurnableERC20(spaceToken).burnFrom(msg.sender, spaceTokenAmount);

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

    // Validate proportions sum to 10000
    uint256 totalBps = 0;
    for (uint256 i = 0; i < proportions.length; i++) {
      require(proportions[i] > 0, 'Proportion must be > 0');
      totalBps += proportions[i];
    }
    require(totalBps == BASIS_POINTS, 'Proportions must sum to 10000');

    address fiatFeed = vaults[vaultId].fiatPriceFeed;

    // Pre-compute all amounts and coverage
    uint256[] memory backingAmounts = new uint256[](backingTokens.length);
    uint256 totalCoverageRemoved = 0;

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];
      BackingTokenConfig storage btConfig = backingConfigs[vaultId][bt];
      require(btConfig.enabled, 'Backing token not active');

      uint256 spaceTokenPortion = (spaceTokenAmount * proportions[i]) /
        BASIS_POINTS;

      uint256 backingOut = _calculateBackingOut(
        spaceTokenPortion,
        btConfig.priceFeed,
        btConfig.tokenDecimals,
        fiatFeed
      );
      require(backingOut > 0, 'Output amount too small');
      require(
        vaultBackingBalance[vaultId][bt] >= backingOut,
        'Insufficient backing in reserve'
      );

      totalCoverageRemoved += _tokenCoverage(
        backingOut,
        btConfig.priceFeed,
        btConfig.tokenDecimals,
        fiatFeed
      );

      backingAmounts[i] = backingOut;
    }

    // Check aggregate minimum backing threshold
    _checkMinimumBacking(
      vaultId,
      spaceToken,
      spaceTokenAmount,
      totalCoverageRemoved
    );

    // Burn the user's space tokens
    IPeggedBurnableERC20(spaceToken).burnFrom(msg.sender, spaceTokenAmount);

    // Distribute backing tokens
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
    return
      _calculateBackingOut(
        spaceTokenAmount,
        btConfig.priceFeed,
        btConfig.tokenDecimals,
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
    uint256 minimumBackingBps
  ) internal returns (uint256 vaultId) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    vaultId = vaultKeys[key];

    if (vaultId == 0) {
      // Validate fiat feed if set
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
        fiatPriceFeed: fiatPriceFeed
      });

      vaultKeys[key] = vaultId;
      spaceVaultIds[spaceId].push(vaultId);

      emit VaultCreated(vaultId, spaceId, spaceToken, fiatPriceFeed);

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
   * @dev Validate all redemption prerequisites: enabled, date, membership/whitelist.
   *
   * Access control logic (OR):
   *   - If both membersOnly AND whitelistEnabled: must be a member OR whitelisted
   *   - If only membersOnly: must be a member
   *   - If only whitelistEnabled: must be whitelisted
   *   - If neither: anyone can redeem
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
      bool isWhitelisted = config.whitelistEnabled &&
        whitelist[vaultId][msg.sender];

      require(isMember || isWhitelisted, 'Not authorized to redeem');
    }
  }

  // ── Oracle helpers ──

  /**
   * @dev Read a Chainlink price feed. Reverts if price is invalid or stale.
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

  /**
   * @dev Get the fiat/USD price. Returns (1e8, 8) for USD peg (address(0)).
   */
  function _getFiatPrice(
    address fiatPriceFeed
  ) internal view returns (uint256 price, uint8 feedDecimals) {
    if (fiatPriceFeed == address(0)) {
      return (1e8, 8); // 1 USD = 1 USD
    }
    return _getOraclePrice(fiatPriceFeed);
  }

  /**
   * @dev Calculate how many backing tokens a user receives for spaceTokenAmount.
   *
   * Since 1 community token = 1 fiat unit:
   *   backingOut = spaceTokenAmount × (fiatPrice / backingPrice) × 10^tokenDecimals / 1e18
   *
   * With feed decimal normalization:
   *   backingOut = spaceTokenAmount × fiatPrice × 10^bpDec × 10^tokenDec
   *              / (backingPrice × 10^fpDec × 1e18)
   */
  function _calculateBackingOut(
    uint256 spaceTokenAmount,
    address backingPriceFeed,
    uint8 backingTokenDecimals,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);
    (uint256 fiatPrice, uint8 fpDec) = _getFiatPrice(fiatPriceFeed);

    uint256 numerator = spaceTokenAmount * fiatPrice;
    uint256 denominator = backingPrice * 1e18;

    // Adjust for different feed decimal precisions
    if (bpDec > fpDec) {
      numerator *= 10 ** (bpDec - fpDec);
    } else if (fpDec > bpDec) {
      denominator *= 10 ** (fpDec - bpDec);
    }

    return (numerator * (10 ** backingTokenDecimals)) / denominator;
  }

  /**
   * @dev Convert a backing token amount to space-token-equivalents (= fiat units × 1e18).
   * Used for aggregate coverage calculations.
   *
   * coverage = balance × backingPrice × 10^fpDec × 1e18
   *          / (10^tokenDec × fiatPrice × 10^bpDec)
   */
  function _tokenCoverage(
    uint256 balance,
    address backingPriceFeed,
    uint8 backingTokenDecimals,
    address fiatPriceFeed
  ) internal view returns (uint256) {
    if (balance == 0) return 0;

    (uint256 backingPrice, uint8 bpDec) = _getOraclePrice(backingPriceFeed);
    (uint256 fiatPrice, uint8 fpDec) = _getFiatPrice(fiatPriceFeed);

    uint256 numerator = balance * backingPrice;
    uint256 denominator = (10 ** backingTokenDecimals) * fiatPrice;

    // Adjust for different feed decimal precisions
    if (fpDec > bpDec) {
      numerator *= 10 ** (fpDec - bpDec);
    } else if (bpDec > fpDec) {
      denominator *= 10 ** (bpDec - fpDec);
    }

    return (numerator * 1e18) / denominator;
  }

  // ── Minimum backing check ──

  /**
   * @dev Check that a redemption won't breach the minimum backing threshold.
   * Computes aggregate coverage across ALL backing tokens using oracle prices.
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

    require(
      remainingCoverage * BASIS_POINTS >= remainingSupply * minBps,
      'Redemption would breach minimum backing threshold'
    );
  }

  /**
   * @dev Sum the fiat-value coverage of all backing tokens in a vault
   * (expressed in space-token-equivalents, i.e., fiat units × 1e18).
   */
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
        totalCoverage += _tokenCoverage(
          balance,
          btConfig.priceFeed,
          btConfig.tokenDecimals,
          fiatFeed
        );
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
