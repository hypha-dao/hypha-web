// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBackingVault {
  // Core vault configuration (one per space token, auto-created)
  // Redeemed community tokens are burned (permanently removed from supply)
  struct VaultConfig {
    uint256 spaceId;
    address spaceToken; // The community/space token users burn to redeem
    bool redeemEnabled; // Can users redeem space tokens for backing?
    bool membersOnly; // Restrict redemption to space members only?
    uint256 minimumBackingBps; // Minimum backing % (basis points, 0-10000) required for redemptions
  }

  // Per backing token configuration within a vault
  struct BackingTokenConfig {
    uint256 exchangeRate; // Backing token base units per 1e18 space token base units
    bool enabled; // Is this backing token currently active for redemption?
  }

  // Initialize the contract
  function initialize(
    address initialOwner,
    address _spacesContract
  ) external;

  // ── Primary entry point: add backing tokens (auto-creates vault if needed) ──

  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    uint256[] calldata exchangeRates,
    uint256[] calldata fundingAmounts,
    uint256 minimumBackingBps
  ) external returns (uint256 vaultId);

  // ── Vault config (executor only) ──

  function removeBackingToken(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external;

  function updateExchangeRate(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 newExchangeRate
  ) external;

  function setRedeemEnabled(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external;

  function setMembersOnly(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external;

  function setMinimumBacking(
    uint256 spaceId,
    address spaceToken,
    uint256 minimumBackingBps
  ) external;

  // ── Funding (anyone can add backing) ──

  function addBacking(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 amount
  ) external;

  // ── User Redemption ──

  function redeem(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address backingToken
  ) external;

  function redeemMulti(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address[] calldata backingTokens,
    uint256[] calldata proportions
  ) external;

  // ── Executor Withdrawals ──

  function withdrawBacking(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    uint256 amount
  ) external;

  // ── View Functions ──

  function getVaultConfig(
    uint256 spaceId,
    address spaceToken
  ) external view returns (VaultConfig memory);

  function getBackingTokens(
    uint256 spaceId,
    address spaceToken
  ) external view returns (address[] memory);

  function getBackingTokenConfig(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external view returns (BackingTokenConfig memory);

  function getBackingBalance(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external view returns (uint256);

  function calculateBackingOut(
    uint256 spaceId,
    address spaceToken,
    uint256 spaceTokenAmount,
    address backingToken
  ) external view returns (uint256);

  function vaultExists(
    uint256 spaceId,
    address spaceToken
  ) external view returns (bool);

  function getSpaceVaults(
    uint256 spaceId
  ) external view returns (uint256[] memory);

  // ── Events ──

  event VaultCreated(
    uint256 indexed vaultId,
    uint256 indexed spaceId,
    address spaceToken
  );

  event BackingTokenAdded(
    uint256 indexed vaultId,
    address indexed backingToken,
    uint256 exchangeRate
  );

  event BackingTokenRemoved(
    uint256 indexed vaultId,
    address indexed backingToken
  );

  event ExchangeRateUpdated(
    uint256 indexed vaultId,
    address indexed backingToken,
    uint256 oldRate,
    uint256 newRate
  );

  event BackingDeposited(
    uint256 indexed vaultId,
    address indexed donor,
    address indexed backingToken,
    uint256 amount
  );

  event Redeemed(
    uint256 indexed vaultId,
    address indexed user,
    uint256 spaceTokensIn,
    address backingToken,
    uint256 backingOut
  );

  event RedeemedMulti(
    uint256 indexed vaultId,
    address indexed user,
    uint256 spaceTokensIn,
    address[] backingTokens,
    uint256[] backingAmounts
  );

  event BackingWithdrawn(
    uint256 indexed vaultId,
    address indexed backingToken,
    uint256 amount
  );

  event RedeemEnabledUpdated(uint256 indexed vaultId, bool enabled);
  event MembersOnlyUpdated(uint256 indexed vaultId, bool enabled);
  event MinimumBackingUpdated(
    uint256 indexed vaultId,
    uint256 minimumBackingBps
  );
}

