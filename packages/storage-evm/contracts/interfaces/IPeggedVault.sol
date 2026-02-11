// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPeggedVault {
  // Core vault configuration (one per space token, auto-created)
  // 1 community token = 1 fiat unit (USD, EUR, JPY, etc.)
  // Redeemed community tokens are burned (permanently removed from supply)
  struct VaultConfig {
    uint256 spaceId;
    address spaceToken; // The community/space token users burn to redeem
    bool redeemEnabled; // Can users redeem space tokens for backing?
    bool membersOnly; // Restrict redemption to space members only?
    bool whitelistEnabled; // Restrict redemption to whitelisted addresses?
    uint256 minimumBackingBps; // Minimum backing % (basis points, 0-10000)
    uint256 redemptionStartDate; // Unix timestamp from which redemptions are allowed (0 = no restriction)
    address fiatPriceFeed; // Chainlink fiat/USD price feed (address(0) = USD peg)
  }

  // Per backing token configuration within a vault
  // No exchangeRate — pricing comes from Chainlink oracles
  struct BackingTokenConfig {
    address priceFeed; // Chainlink price feed (e.g., ETH/USD, BTC/USD)
    uint8 tokenDecimals; // Token decimals (6 for USDC/EURC, 18 for WETH, 8 for WBTC)
    bool enabled;
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
    address[] calldata priceFeeds,
    uint8[] calldata tokenDecimals,
    uint256[] calldata fundingAmounts,
    address fiatPriceFeed,
    uint256 minimumBackingBps
  ) external returns (uint256 vaultId);

  // ── Vault config (executor only) ──

  function removeBackingToken(
    uint256 spaceId,
    address spaceToken,
    address backingToken
  ) external;

  function updatePriceFeed(
    uint256 spaceId,
    address spaceToken,
    address backingToken,
    address newPriceFeed
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

  function setWhitelistEnabled(
    uint256 spaceId,
    address spaceToken,
    bool enabled
  ) external;

  function setMinimumBacking(
    uint256 spaceId,
    address spaceToken,
    uint256 minimumBackingBps
  ) external;

  function setRedemptionStartDate(
    uint256 spaceId,
    address spaceToken,
    uint256 startDate
  ) external;

  function addToWhitelist(
    uint256 spaceId,
    address spaceToken,
    address[] calldata accounts
  ) external;

  function removeFromWhitelist(
    uint256 spaceId,
    address spaceToken,
    address[] calldata accounts
  ) external;

  // ── Funding (executor only) ──

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

  function isWhitelisted(
    uint256 spaceId,
    address spaceToken,
    address account
  ) external view returns (bool);

  // ── Events ──

  event VaultCreated(
    uint256 indexed vaultId,
    uint256 indexed spaceId,
    address spaceToken,
    address fiatPriceFeed
  );

  event BackingTokenAdded(
    uint256 indexed vaultId,
    address indexed backingToken,
    address priceFeed
  );

  event BackingTokenRemoved(
    uint256 indexed vaultId,
    address indexed backingToken
  );

  event PriceFeedUpdated(
    uint256 indexed vaultId,
    address indexed backingToken,
    address oldFeed,
    address newFeed
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
  event WhitelistEnabledUpdated(uint256 indexed vaultId, bool enabled);
  event MinimumBackingUpdated(
    uint256 indexed vaultId,
    uint256 minimumBackingBps
  );
  event RedemptionStartDateUpdated(
    uint256 indexed vaultId,
    uint256 startDate
  );
  event WhitelistUpdated(
    uint256 indexed vaultId,
    address[] accounts,
    bool added
  );
}

