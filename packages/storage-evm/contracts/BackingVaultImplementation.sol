// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './storage/BackingVaultStorage.sol';
import './interfaces/IBackingVault.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @dev Minimal interface for ERC20 tokens that support burnFrom.
 * All Hypha space tokens (RegularSpaceToken, OwnershipSpaceToken, DecayingSpaceToken)
 * extend ERC20BurnableUpgradeable, so they all support this.
 */
interface IBurnableERC20 {
  function burnFrom(address account, uint256 amount) external;
}

/**
 * @title BackingVaultImplementation
 * @dev One-way redemption vault for space tokens. Users send community tokens IN
 * (which are burned) and choose which backing token(s) they want OUT.
 *
 * The vault is auto-created on first addBackingToken() call — no separate setup step.
 * All functions use (spaceId, spaceToken) as the natural key.
 * Redeemed community tokens are permanently burned, reducing total supply.
 *
 * Minimal setup (single proposal, multiple backing tokens at once):
 *   addBackingToken(spaceId, spaceToken, [usdc, hypha], [2e6, 500e15], [50_000e6, 10_000e18], 2000)
 *   → vault auto-created + USDC & HYPHA added + funded + 20% min backing
 *
 * Exchange rate: backing token base units per 1e18 space token base units
 *   Example: 1 space token = 2 USDC  → exchangeRate = 2_000_000
 *   Example: 1 space token = 0.5 HYPHA → exchangeRate = 500_000_000_000_000_000
 */
contract BackingVaultImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  BackingVaultStorage,
  IBackingVault
{
  using SafeERC20 for IERC20;

  uint256 public constant BASIS_POINTS = 10000;

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
   * @dev Add one or more backing tokens to a space token's vault, optionally
   * funding the reserve for each in the same transaction.
   *
   * If no vault exists yet for this (spaceId, spaceToken), it is auto-created.
   * Each fundingAmounts[i] > 0 deposits that amount; pass 0 to skip funding.
   * minimumBackingBps > 0 sets a minimum backing floor (only on vault creation).
   *
   * Full setup (single proposal, multiple tokens):
   *   addBackingToken(
   *     spaceId, tokenAddr,
   *     [usdc, hypha],            // backing tokens
   *     [2_000_000, 500e15],      // exchange rates
   *     [50_000e6, 10_000e18],    // funding amounts
   *     2000                      // 20% minimum backing
   *   )
   *
   * Add-only (fund separately later):
   *   addBackingToken(spaceId, tokenAddr, [usdc], [2_000_000], [0], 0)
   *
   * @param spaceId The space this token belongs to
   * @param spaceToken The community/space token users will send IN
   * @param backingTokens The reserve tokens users can redeem for
   * @param exchangeRates Backing token base units per 1e18 space token base units (per token)
   * @param fundingAmounts Amount of each backing token to deposit (0 = skip funding)
   * @param minimumBackingBps Minimum backing % in basis points (0 = no floor, only applied on vault creation)
   * @return vaultId The internal vault ID (for reference)
   */
  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    uint256[] calldata exchangeRates,
    uint256[] calldata fundingAmounts,
    uint256 minimumBackingBps
  ) external nonReentrant returns (uint256 vaultId) {
    _requireExecutorOrOwner(spaceId);

    require(spaceToken != address(0), 'Invalid space token');
    require(backingTokens.length > 0, 'No backing tokens specified');
    require(
      backingTokens.length == exchangeRates.length &&
        backingTokens.length == fundingAmounts.length,
      'Array lengths must match'
    );
    require(
      minimumBackingBps <= BASIS_POINTS,
      'Min backing cannot exceed 100%'
    );

    // Auto-create vault if it doesn't exist
    vaultId = _getOrCreateVault(spaceId, spaceToken, minimumBackingBps);

    for (uint256 i = 0; i < backingTokens.length; i++) {
      address bt = backingTokens[i];

      require(bt != address(0), 'Invalid backing token');
      require(bt != spaceToken, 'Backing token cannot be the space token');
      require(exchangeRates[i] > 0, 'Exchange rate must be > 0');
      require(
        !backingConfigs[vaultId][bt].enabled,
        'Backing token already added'
      );

      backingConfigs[vaultId][bt] = BackingTokenConfig({
        exchangeRate: exchangeRates[i],
        enabled: true
      });

      backingTokenList[vaultId].push(bt);

      emit BackingTokenAdded(vaultId, bt, exchangeRates[i]);

      // Optionally fund the reserve in the same transaction
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

  /**
   * @dev Remove a backing token. Remaining balance can still be withdrawn.
   */
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

    // Remove from the list (swap and pop)
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
   * @dev Update the exchange rate for a specific backing token.
   */
  function updateExchangeRate(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 newExchangeRate
  ) external {
    _requireExecutorOrOwner(spaceId);
    uint256 vaultId = _requireVault(spaceId, spaceToken);

    require(
      backingConfigs[vaultId][backingToken].enabled,
      'Backing token not active'
    );
    require(newExchangeRate > 0, 'Exchange rate must be > 0');

    uint256 oldRate = backingConfigs[vaultId][backingToken].exchangeRate;
    backingConfigs[vaultId][backingToken].exchangeRate = newExchangeRate;

    emit ExchangeRateUpdated(vaultId, backingToken, oldRate, newExchangeRate);
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

  /**
   * @dev Update the minimum backing threshold (basis points, 0-10000).
   * When set > 0, redemptions are blocked if they would cause the aggregate
   * coverage across ALL backing tokens to fall below this % of remaining supply.
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

  // ============================================================
  //                    FUNDING (add backing)
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
   */
  function redeem(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address[] calldata backingTokens,
    uint256[] calldata proportions
  ) external nonReentrant {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    VaultConfig storage config = vaults[vaultId];

    require(config.redeemEnabled, 'Redemptions are disabled');
    require(spaceTokenAmount > 0, 'Amount must be > 0');
    require(backingTokens.length > 0, 'No backing tokens specified');
    require(
      backingTokens.length == proportions.length,
      'Array lengths must match'
    );

    if (config.membersOnly) {
      require(
        IDAOSpaceFactory(spacesContract).isMember(spaceId, msg.sender),
        'Only space members can redeem'
      );
    }

    uint256 totalBps = 0;
    for (uint256 i = 0; i < proportions.length; i++) {
      require(proportions[i] > 0, 'Proportion must be > 0');
      totalBps += proportions[i];
    }
    require(totalBps == BASIS_POINTS, 'Proportions must sum to 10000');

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
        btConfig.exchangeRate
      );
      require(backingOut > 0, 'Output amount too small');
      require(
        vaultBackingBalance[vaultId][bt] >= backingOut,
        'Insufficient backing in reserve'
      );

      totalCoverageRemoved += (backingOut * 1e18) / btConfig.exchangeRate;

      backingAmounts[i] = backingOut;
    }

    _checkMinimumBacking(
      vaultId,
      spaceToken,
      spaceTokenAmount,
      totalCoverageRemoved
    );

    IBurnableERC20(spaceToken).burnFrom(msg.sender, spaceTokenAmount);

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

  /**
   * @dev Withdraw backing tokens from the reserve.
   */
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

  /**
   * @dev Update the spaces contract address (owner only)
   */
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
    return _calculateBackingOut(spaceTokenAmount, btConfig.exchangeRate);
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

  // ============================================================
  //                     INTERNAL HELPERS
  // ============================================================

  /**
   * @dev Get existing vault or create a new one.
   * Called by addBackingToken — the only way a vault is created.
   * @param minimumBackingBps Only applied when creating a new vault; ignored if vault exists.
   */
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
        redeemEnabled: true, // sensible default: ready to use immediately
        membersOnly: false, // sensible default: open to all token holders
        minimumBackingBps: minimumBackingBps
      });

      vaultKeys[key] = vaultId;
      spaceVaultIds[spaceId].push(vaultId);

      emit VaultCreated(vaultId, spaceId, spaceToken);

      if (minimumBackingBps > 0) {
        emit MinimumBackingUpdated(vaultId, minimumBackingBps);
      }
    }
  }

  /**
   * @dev Look up vault ID, revert if it doesn't exist.
   */
  function _requireVault(
    uint256 spaceId,
    address spaceToken
  ) internal view returns (uint256 vaultId) {
    bytes32 key = _getVaultKey(spaceId, spaceToken);
    vaultId = vaultKeys[key];
    require(vaultId != 0, 'Vault does not exist');
  }

  /**
   * @dev Check that a redemption won't breach the minimum backing threshold.
   * Computes AGGREGATE coverage across ALL backing tokens by converting each
   * token's reserve to space-token-equivalents via its exchange rate:
   *
   *   coverage[i] = balance[i] * 1e18 / exchangeRate[i]
   *   totalCoverage = sum(coverage[i])
   *
   * After subtracting the coverage being removed, the remaining coverage must
   * still be >= minimumBackingBps % of the remaining space token supply.
   *
   * @param vaultId Internal vault ID
   * @param spaceToken The space token (to read totalSupply)
   * @param spaceTokensBurned How many space tokens will be burned in this redemption
   * @param coverageRemoved Space-token-equivalent value of backing tokens leaving the vault
   */
  function _checkMinimumBacking(
    uint256 vaultId,
    address spaceToken,
    uint256 spaceTokensBurned,
    uint256 coverageRemoved
  ) internal view {
    uint256 minBps = vaults[vaultId].minimumBackingBps;
    if (minBps == 0) return; // No minimum set — all redemptions allowed

    uint256 currentSupply = IERC20(spaceToken).totalSupply();
    uint256 remainingSupply = currentSupply - spaceTokensBurned;

    if (remainingSupply == 0) return; // All tokens redeemed — no floor to enforce

    // Sum coverage across ALL backing tokens
    uint256 totalCoverage = _computeTotalCoverage(vaultId);
    uint256 remainingCoverage = totalCoverage - coverageRemoved;

    // remainingCoverage / remainingSupply >= minBps / BASIS_POINTS
    // Rearranged to avoid division:
    require(
      remainingCoverage * BASIS_POINTS >= remainingSupply * minBps,
      'Redemption would breach minimum backing threshold'
    );
  }

  /**
   * @dev Sum the space-token-equivalent coverage of all backing tokens in a vault.
   * Each backing token's balance is converted: coverage = balance * 1e18 / exchangeRate
   */
  function _computeTotalCoverage(
    uint256 vaultId
  ) internal view returns (uint256 totalCoverage) {
    address[] storage tokens = backingTokenList[vaultId];
    for (uint256 i = 0; i < tokens.length; i++) {
      address bt = tokens[i];
      uint256 balance = vaultBackingBalance[vaultId][bt];
      uint256 rate = backingConfigs[vaultId][bt].exchangeRate;
      if (balance > 0 && rate > 0) {
        totalCoverage += (balance * 1e18) / rate;
      }
    }
  }

  /**
   * @dev Calculate backing tokens out.
   * Formula: backingOut = (spaceTokenAmount * exchangeRate) / 1e18
   */
  function _calculateBackingOut(
    uint256 spaceTokenAmount,
    uint256 exchangeRate
  ) internal pure returns (uint256) {
    return (spaceTokenAmount * exchangeRate) / 1e18;
  }

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
