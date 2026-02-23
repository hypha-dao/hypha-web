// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenBackingVault {
  // Core vault configuration (one per space token, auto-created)
  // Redeemed community tokens are burned (permanently removed from supply)
  // Peg value and fiat currency are read from the space token contract at runtime:
  //   spaceToken.priceInUSD()        → price value (6 decimals)
  //   spaceToken.priceCurrencyFeed() → Chainlink X/USD feed (address(0) = USD)
  struct VaultConfig {
    uint256 spaceId;
    address spaceToken;
    bool redeemEnabled;
    bool membersOnly; // Restrict to space members
    bool whitelistEnabled; // Restrict to whitelisted addresses (OR with membersOnly)
    uint256 minimumBackingBps; // Minimum backing % (basis points, 0-10000)
    uint256 redemptionStartDate; // Unix timestamp, 0 = no restriction
  }

  // Per backing token configuration
  // priceFeed != address(0) → oracle-priced token (USDC, EURC, WETH, WBTC)
  // priceFeed == address(0) → Hypha token (price read from token.priceInUSD())
  struct BackingTokenConfig {
    address priceFeed; // Chainlink feed or address(0) for Hypha tokens
    uint8 tokenDecimals;
    bool enabled;
  }

  function initialize(
    address initialOwner,
    address _spacesContract
  ) external;

  // ── Primary entry point ──

  function addBackingToken(
    uint256 spaceId,
    address spaceToken,
    address[] calldata backingTokens,
    address[] calldata priceFeeds,
    uint8[] calldata tokenDecimals,
    uint256[] calldata fundingAmounts,
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
    address[] calldata backingTokens,
    uint256[] calldata amounts
  ) external;

  // ── User Redemption ──

  function redeem(
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
    address spaceToken
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

