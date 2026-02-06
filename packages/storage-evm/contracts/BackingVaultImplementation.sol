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
 * Minimal setup (single proposal):
 *   addBackingToken(spaceId, spaceTokenAddr, usdcAddr, 2_000_000)
 *   → vault auto-created + USDC added as backing at 2 USDC per token
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
   * @dev Add a backing token to a space token's vault.
   * If no vault exists yet for this (spaceId, spaceToken), it is auto-created.
   *
   * This is the only function needed to set up a vault — one proposal does it all.
   *
   * @param spaceId The space this token belongs to
   * @param spaceToken The community/space token users will send IN
   * @param backingToken The reserve token users can redeem for (e.g., USDC, HYPHA)
   * @param exchangeRate Backing token base units per 1e18 space token base units
   * @return vaultId The internal vault ID (for reference)
   */
  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 exchangeRate
  ) external returns (uint256 vaultId) {
    _requireExecutorOrOwner(spaceId);

    require(spaceToken != address(0), 'Invalid space token');
    require(backingToken != address(0), 'Invalid backing token');
    require(
      backingToken != spaceToken,
      'Backing token cannot be the space token'
    );
    require(exchangeRate > 0, 'Exchange rate must be > 0');

    // Auto-create vault if it doesn't exist
    vaultId = _getOrCreateVault(spaceId, spaceToken);

    // Add the backing token
    require(
      !backingConfigs[vaultId][backingToken].enabled,
      'Backing token already added'
    );

    backingConfigs[vaultId][backingToken] = BackingTokenConfig({
      exchangeRate: exchangeRate,
      enabled: true
    });

    backingTokenList[vaultId].push(backingToken);

    emit BackingTokenAdded(vaultId, backingToken, exchangeRate);

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

  // ============================================================
  //                    FUNDING (add backing)
  // ============================================================

  /**
   * @dev Add backing tokens to the vault reserve. Anyone can call this.
   * Caller must have approved this contract to spend the backing token.
   */
  function addBacking(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 amount
  ) external nonReentrant {
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
   * @dev Redeem space tokens for a single chosen backing token.
   * User's space tokens are burned, and they receive backing tokens OUT.
   * The user must have approved this contract to spend their space tokens (for burnFrom).
   */
  function redeem(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address backingToken
  ) external nonReentrant {
    uint256 vaultId = _requireVault(spaceId, spaceToken);
    VaultConfig storage config = vaults[vaultId];

    require(config.redeemEnabled, 'Redemptions are disabled');
    require(spaceTokenAmount > 0, 'Amount must be > 0');

    if (config.membersOnly) {
      require(
        IDAOSpaceFactory(spacesContract).isMember(spaceId, msg.sender),
        'Only space members can redeem'
      );
    }

    BackingTokenConfig storage btConfig = backingConfigs[vaultId][backingToken];
    require(btConfig.enabled, 'Backing token not active');

    uint256 backingOut = _calculateBackingOut(
      spaceTokenAmount,
      btConfig.exchangeRate
    );
    require(backingOut > 0, 'Output amount too small');
    require(
      vaultBackingBalance[vaultId][backingToken] >= backingOut,
      'Insufficient backing in reserve'
    );

    // Burn the user's space tokens (permanently reduces supply)
    IBurnableERC20(spaceToken).burnFrom(msg.sender, spaceTokenAmount);

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
   * User's space tokens are burned, and they receive multiple backing tokens OUT.
   *
   * Proportions are in basis points (out of 10000).
   * Example: [6000, 4000] means 60% in first token, 40% in second token.
   */
  function redeemMulti(
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

    // Validate proportions sum to 10000
    uint256 totalBps = 0;
    for (uint256 i = 0; i < proportions.length; i++) {
      require(proportions[i] > 0, 'Proportion must be > 0');
      totalBps += proportions[i];
    }
    require(totalBps == BASIS_POINTS, 'Proportions must sum to 10000');

    // Burn the user's space tokens first (permanently reduces supply)
    IBurnableERC20(spaceToken).burnFrom(msg.sender, spaceTokenAmount);

    // Distribute each backing token
    uint256[] memory backingAmounts = new uint256[](backingTokens.length);

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

      vaultBackingBalance[vaultId][bt] -= backingOut;
      IERC20(bt).safeTransfer(msg.sender, backingOut);

      backingAmounts[i] = backingOut;
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
   * Called by addBackingToken — this is the only way a vault is created.
   */
  function _getOrCreateVault(
    uint256 spaceId,
    address spaceToken
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
        membersOnly: false // sensible default: open to all token holders
      });

      vaultKeys[key] = vaultId;
      spaceVaultIds[spaceId].push(vaultId);

      emit VaultCreated(vaultId, spaceId, spaceToken);
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
