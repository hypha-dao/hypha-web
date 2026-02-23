# Token Backing Vault — Frontend Integration Guide

## Overview

The **TokenBackingVault** is a fiat-referenced redemption vault that lets community token holders redeem (burn) their tokens for backing assets (USDC, WETH, other Hypha tokens, etc.) at the token's pegged price.

A token's **price** and **denomination currency** are set in two places:

1. **At token deployment** — via the `tokenPrice` and `priceCurrencyFeed` parameters in the factory `deployToken` / `deployDecayingToken` / `deployOwnershipToken` functions.
2. **After deployment** — via `setPriceWithCurrency(price, currencyFeed)` on the token contract (called through a DAO proposal).

The vault reads the token's price and currency **directly from the token contract at redemption time** — no duplicate configuration needed. If the Space updates their token price to "2 EUR" via `setPriceWithCurrency`, the vault automatically uses that new price on the next redemption.

All prices flow through **USD as the common denominator**: space token price (in its currency) is converted to USD via Chainlink, then divided by the backing token's USD price to determine the output amount.

---

## Network & Contract Address

**Base Mainnet** (Chain ID: `8453`)

| Contract | Address |
|---|---|
| **TokenBackingVault (Proxy)** | [`0x9997C22f06F0aC67dF07C8Cb2A08562C53dD4E9f`](https://basescan.org/address/0x9997C22f06F0aC67dF07C8Cb2A08562C53dD4E9f) |

---

## Key Concepts

| Concept | Description |
|---|---|
| **Space Token** | The community token being redeemed (burned on redemption) |
| **Backing Token** | Assets held in reserve (USDC, WETH, other Hypha tokens) |
| **Oracle-priced** | Backing tokens priced via Chainlink (USDC, WETH, WBTC, etc.) |
| **Hypha-priced** | Backing tokens that are other Hypha community tokens — price read from their `tokenPrice()` |
| **priceCurrencyFeed** | Chainlink X/USD feed for non-USD currencies. `address(0)` means USD. |
| **Vault ID** | Internal identifier; lookups use `(spaceId, spaceToken)` pair |
| **Minimum Backing** | Percentage (basis points, 0–10000) — redemptions blocked if reserve coverage drops below this |

---

## TokenBackingVault — Function Overview

### Setup & Configuration (executor/proposal only)

| Function | Description |
|---|---|
| `addBackingToken(spaceId, spaceToken, backingTokens[], priceFeeds[], tokenDecimals[], fundingAmounts[], minimumBackingBps)` | Create a vault (if not exists) and register one or more backing tokens with optional initial funding. Chainlink feed for oracle-priced tokens, `address(0)` for Hypha tokens. |
| `removeBackingToken(spaceId, spaceToken, backingToken)` | Disable a backing token from the vault. |
| `updatePriceFeed(spaceId, spaceToken, backingToken, newPriceFeed)` | Change the Chainlink feed for an oracle-priced backing token. Cannot be used on Hypha tokens. |
| `setRedeemEnabled(spaceId, spaceToken, enabled)` | Enable or disable all redemptions for this vault. |
| `setMembersOnly(spaceId, spaceToken, enabled)` | Restrict redemptions to Space members only. |
| `setWhitelistEnabled(spaceId, spaceToken, enabled)` | Restrict redemptions to whitelisted addresses. |
| `setMinimumBacking(spaceId, spaceToken, minimumBackingBps)` | Set the minimum backing threshold (basis points). |
| `setRedemptionStartDate(spaceId, spaceToken, startDate)` | Set a future Unix timestamp from which redemptions are allowed. `0` = no restriction. |
| `addToWhitelist(spaceId, spaceToken, accounts[])` | Add addresses to the redemption whitelist. |
| `removeFromWhitelist(spaceId, spaceToken, accounts[])` | Remove addresses from the redemption whitelist. |

### Funding & Withdrawals (executor/proposal only)

| Function | Description |
|---|---|
| `addBacking(spaceId, spaceToken, backingTokens[], amounts[])` | Deposit more backing tokens into the vault. Accepts arrays so multiple tokens can be funded in one call. Caller must approve the vault first. |
| `withdrawBacking(spaceId, spaceToken, backingToken, amount)` | Withdraw backing tokens from the vault back to the executor. |

### User Redemption

| Function | Description |
|---|---|
| `redeem(spaceId, spaceToken, spaceTokenAmount, backingTokens[], proportions[])` | Burn community tokens and receive one or more backing tokens in specified proportions (basis points, must sum to 10000). For a single token, pass `[token]` and `[10000]`. |

### Read / View Functions

| Function | Returns | Description |
|---|---|---|
| `vaultExists(spaceId, spaceToken)` | `bool` | Whether a vault exists for this (spaceId, spaceToken) pair. |
| `getVaultConfig(spaceId, spaceToken)` | `VaultConfig` | Full vault config: spaceId, spaceToken, redeemEnabled, membersOnly, whitelistEnabled, minimumBackingBps, redemptionStartDate. |
| `getBackingTokens(spaceId, spaceToken)` | `address[]` | List of all active backing token addresses. |
| `getBackingTokenConfig(spaceId, spaceToken, backingToken)` | `BackingTokenConfig` | Config for a backing token: priceFeed, tokenDecimals, enabled. |
| `getBackingBalance(spaceId, spaceToken, backingToken)` | `uint256` | Current balance of a backing token held in the vault. |
| `calculateBackingOut(spaceId, spaceToken, spaceTokenAmount, backingToken)` | `uint256` | Preview: how many backing tokens would be received for the given space token amount. |
| `getSpaceVaults(spaceId)` | `uint256[]` | All vault IDs associated with a space. |
| `isWhitelisted(spaceId, spaceToken, account)` | `bool` | Whether an address is on the vault whitelist. |

---

## Supported Chainlink Currency Feeds (Base Mainnet)

### Fiat Currency Feeds (for `priceCurrencyFeed` on token deploy / `setPriceWithCurrency`)

Use these when a community token is denominated in a non-USD fiat currency. Pass these as the `priceCurrencyFeed` parameter during token deployment or when calling `setPriceWithCurrency` on the token contract.

| Currency | Pair | Address | Deviation | Risk | Available |
|---|---|---|---|---|---|
| **US Dollar (USD)** | — | `address(0)` | — | — | Yes |
| **Euro (EUR)** | EUR/USD | `0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F` | 0.1% | Low | Yes |
| **British Pound (GBP)** | GBP/USD | `0xCceA6576904C118037695eB71195a5425E69Fa15` | 0.5% | Medium | Yes |
| **Canadian Dollar (CAD)** | CAD/USD | `0xA840145F87572E82519d578b1F36340368a25D5d` | 0.1% | Low | Yes |
| **Swiss Franc (CHF)** | CHF/USD | `0x3A1d6444fb6a402470098E23DaD0B7E86E14252F` | 0.5% | Low | Yes |
| **Australian Dollar (AUD)** | AUD/USD | `0x46e51B8cA41d709928EdA9Ae43e42193E6CDf229` | 0.5% | Low | Yes |
| **Chinese Yuan (CNY)** | — | — | — | — | **No** |
| **Japanese Yen (JPY)** | — | — | — | — | **No** |
| **Hong Kong Dollar (HKD)** | — | — | — | — | **No** |

### Asset Price Feeds (for oracle-priced backing tokens in the vault)

Use these as the `priceFeed` parameter when calling `addBackingToken` on the vault. These price the backing assets themselves — they are NOT passed during token creation.

| Asset | Pair | Address | Deviation |
|---|---|---|---|
| **USDC** | USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | 0.3% |
| **EURC** | EURC/USD | `0xDAe398520e2B67cd3f27aeF9Cf14D93D927f8250` | 0.3% |
| **ETH / WETH** | ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | 0.15% |
| **BTC / WBTC** | BTC/USD | `0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F` | 0.1% |

> For additional feeds on Base mainnet (WBTC/USD, LINK/USD, etc.), see the [Chainlink Price Feed Directory for Base](https://docs.chain.link/data-feeds/price-feeds/addresses?network=base). The contract is compatible with any Chainlink AggregatorV3Interface feed.

---

## Changes to Token Factory Deploy Functions

All three token factory contracts now accept **two new parameters** for price configuration: `tokenPrice` and `priceCurrencyFeed`. These are required for the backing vault integration to work.

### RegularTokenFactory.deployToken

```solidity
function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 tokenPrice,               // NEW — price in 6 decimals (e.g. 2_000_000 = 2.00)
    address priceCurrencyFeed,        // NEW — Chainlink X/USD feed, address(0) = USD
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist
) public returns (address)
```

### DecayingTokenFactory.deployDecayingToken

```solidity
function deployDecayingToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 tokenPrice,               // NEW — price in 6 decimals
    address priceCurrencyFeed,        // NEW — Chainlink X/USD feed, address(0) = USD
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist,
    uint256 decayPercentage,
    uint256 decayInterval
) public returns (address)
```

### OwnershipTokenFactory.deployOwnershipToken

```solidity
function deployOwnershipToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool fixedMaxSupply,
    bool autoMinting,
    uint256 tokenPrice,               // NEW — price in 6 decimals
    address priceCurrencyFeed,        // NEW — Chainlink X/USD feed, address(0) = USD
    bool useTransferWhitelist,
    bool useReceiveWhitelist,
    address[] memory initialTransferWhitelist,
    address[] memory initialReceiveWhitelist
) public returns (address)
```

### New Parameter Details

| Parameter | Type | Description |
|---|---|---|
| `tokenPrice` | `uint256` | Token price with 6 decimals. Example: `2_000_000` = 2.00 in the given currency. Set to `0` if no price yet. |
| `priceCurrencyFeed` | `address` | Chainlink X/USD feed address for the token's denomination currency. `address(0)` = USD. See [Supported Currency Feeds](#fiat-currency-feeds-for-pricecurrencyfeed-on-token-deploy--setpricewithcurrency) above. |

### Frontend Example — Deploy a USD-priced token

```typescript
await regularTokenFactory.deployToken(
  spaceId,
  "Green Token",
  "GREEN",
  ethers.parseEther("1000000"),  // maxSupply: 1M tokens
  true,                          // transferable
  false,                         // fixedMaxSupply
  false,                         // autoMinting
  2_000_000,                     // tokenPrice: $2.00 USD (6 decimals)
  ethers.ZeroAddress,            // priceCurrencyFeed: address(0) = USD
  false,                         // useTransferWhitelist
  false,                         // useReceiveWhitelist
  [],                            // initialTransferWhitelist
  []                             // initialReceiveWhitelist
);
```

### Frontend Example — Deploy a EUR-priced token

```typescript
const EUR_USD_FEED = "0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F";

await regularTokenFactory.deployToken(
  spaceId,
  "Euro Community Token",
  "EUCT",
  ethers.parseEther("500000"),
  true,                          // transferable
  false,                         // fixedMaxSupply
  false,                         // autoMinting
  1_500_000,                     // tokenPrice: 1.50 EUR (6 decimals)
  EUR_USD_FEED,                  // priceCurrencyFeed: EUR/USD Chainlink feed
  false,                         // useTransferWhitelist
  false,                         // useReceiveWhitelist
  [],
  []
);
```

---

## Vault Contract — Detailed Usage

### Read Functions (no gas, call from frontend)

#### Check if a vault exists

```typescript
const exists: boolean = await vault.vaultExists(spaceId, spaceTokenAddress);
```

#### Get vault configuration

```typescript
const config = await vault.getVaultConfig(spaceId, spaceTokenAddress);
// Returns: { spaceId, spaceToken, redeemEnabled, membersOnly,
//            whitelistEnabled, minimumBackingBps, redemptionStartDate }
```

#### Get all backing tokens for a vault

```typescript
const backingTokens: string[] = await vault.getBackingTokens(spaceId, spaceTokenAddress);
```

#### Get backing token config (price feed, decimals, enabled)

```typescript
const btConfig = await vault.getBackingTokenConfig(spaceId, spaceTokenAddress, backingTokenAddress);
// Returns: { priceFeed, tokenDecimals, enabled }
// priceFeed == address(0) means it's a Hypha token (price from contract)
```

#### Get backing balance in the vault

```typescript
const balance: bigint = await vault.getBackingBalance(spaceId, spaceTokenAddress, backingTokenAddress);
```

#### Preview redemption output (how many backing tokens for X space tokens)

```typescript
const backingOut: bigint = await vault.calculateBackingOut(
  spaceId,
  spaceTokenAddress,
  spaceTokenAmount,   // in wei (18 decimals)
  backingTokenAddress
);
```

#### Check whitelist status

```typescript
const isWl: boolean = await vault.isWhitelisted(spaceId, spaceTokenAddress, userAddress);
```

#### Get all vault IDs for a space

```typescript
const vaultIds: bigint[] = await vault.getSpaceVaults(spaceId);
```

---

### Write Functions (require transactions)

#### Redeem space tokens for a single backing token

```typescript
// User must first approve the vault to spend their space tokens:
await spaceToken.approve(vaultAddress, spaceTokenAmount);

await vault.redeem(
  spaceId,
  spaceTokenAddress,
  spaceTokenAmount,              // amount of community tokens to burn
  [backingTokenAddress],         // which backing token(s) to receive
  [10000]                        // 100% to one token
);
```

#### Redeem space tokens for multiple backing tokens

```typescript
await spaceToken.approve(vaultAddress, spaceTokenAmount);

await vault.redeem(
  spaceId,
  spaceTokenAddress,
  spaceTokenAmount,
  [usdcAddress, wethAddress],    // backing tokens
  [7000, 3000]                   // proportions in basis points (70% USDC, 30% WETH)
);
```

> Proportions must sum to exactly `10000` (100%).

---

### Executor/Proposal Functions

These are called by the space executor (via a DAO proposal). The frontend should encode these as proposal transaction data.

#### Create a vault and add backing tokens

```typescript
// Called via proposal — the executor transfers backing tokens from the treasury
await vault.addBackingToken(
  spaceId,
  spaceTokenAddress,
  [usdcAddress, wethAddress],               // backing tokens
  [USDC_USD_FEED, ETH_USD_FEED],            // Chainlink asset feeds (NOT currency feeds)
  [6, 18],                                  // token decimals
  [ethers.parseUnits("50000", 6), ethers.parseEther("10")],  // funding amounts
  2000                                      // 20% minimum backing (basis points)
);
```

#### Deposit more backing

```typescript
// Single token
await vault.addBacking(spaceId, spaceTokenAddress, [backingTokenAddress], [amount]);

// Multiple tokens in one call
await vault.addBacking(
  spaceId,
  spaceTokenAddress,
  [usdcAddress, wethAddress],
  [ethers.parseUnits("10000", 6), ethers.parseEther("5")]
);
```

#### Toggle redemptions

```typescript
await vault.setRedeemEnabled(spaceId, spaceTokenAddress, true);   // enable
await vault.setRedeemEnabled(spaceId, spaceTokenAddress, false);  // disable
```

#### Set redemption start date

```typescript
await vault.setRedemptionStartDate(spaceId, spaceTokenAddress, unixTimestamp);
// Pass 0 to remove the restriction
```

#### Set members-only / whitelist

```typescript
await vault.setMembersOnly(spaceId, spaceTokenAddress, true);
await vault.setWhitelistEnabled(spaceId, spaceTokenAddress, true);
await vault.addToWhitelist(spaceId, spaceTokenAddress, [addr1, addr2, addr3]);
await vault.removeFromWhitelist(spaceId, spaceTokenAddress, [addr1]);
```

#### Remove a backing token

```typescript
await vault.removeBackingToken(spaceId, spaceTokenAddress, backingTokenAddress);
```

#### Withdraw backing from vault

```typescript
await vault.withdrawBacking(spaceId, spaceTokenAddress, backingTokenAddress, amount);
```

#### Update a price feed

```typescript
await vault.updatePriceFeed(spaceId, spaceTokenAddress, backingTokenAddress, newFeedAddress);
```

---

## Events to Index

| Event | When Emitted |
|---|---|
| `VaultCreated(vaultId, spaceId, spaceToken)` | First time `addBackingToken` is called for a (spaceId, spaceToken) pair |
| `BackingTokenAdded(vaultId, backingToken, priceFeed)` | A new backing token is registered |
| `BackingTokenRemoved(vaultId, backingToken)` | A backing token is disabled |
| `BackingDeposited(vaultId, donor, backingToken, amount)` | Tokens are deposited into the vault |
| `Redeemed(vaultId, user, spaceTokensIn, backingTokens[], backingAmounts[])` | Redemption (single or multi-token) |
| `BackingWithdrawn(vaultId, backingToken, amount)` | Executor withdraws reserves |
| `RedeemEnabledUpdated(vaultId, enabled)` | Redemptions toggled |
| `MembersOnlyUpdated(vaultId, enabled)` | Members-only toggled |
| `WhitelistEnabledUpdated(vaultId, enabled)` | Whitelist toggled |
| `MinimumBackingUpdated(vaultId, minimumBackingBps)` | Minimum backing threshold changed |
| `RedemptionStartDateUpdated(vaultId, startDate)` | Redemption start date changed |
| `WhitelistUpdated(vaultId, accounts, added)` | Whitelist entries added/removed |
| `PriceFeedUpdated(vaultId, backingToken, oldFeed, newFeed)` | Price feed changed |

---

## Frontend Flow: User Redemption

```
1. Check vault exists
   → vaultExists(spaceId, spaceToken)

2. Read vault config
   → getVaultConfig(spaceId, spaceToken)
   → Check: redeemEnabled == true
   → Check: redemptionStartDate == 0 || now >= redemptionStartDate

3. Check user eligibility (if restrictions are active)
   → If membersOnly: check isMember on DAOSpaceFactory
   → If whitelistEnabled: isWhitelisted(spaceId, spaceToken, userAddress)
   → User passes if EITHER check succeeds

4. Get available backing tokens
   → getBackingTokens(spaceId, spaceToken)
   → For each: getBackingBalance(spaceId, spaceToken, bt)

5. Let user pick backing token(s) and input amount

6. Preview the output
   → calculateBackingOut(spaceId, spaceToken, amount, backingToken)

7. Execute
   → User approves vault to spend their space tokens
   → Call redeem() with backing token(s) and proportions
```

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `BASIS_POINTS` | `10000` | 100% in basis points |
| `PRICE_PRECISION` | `1e6` | Token prices use 6 decimal places |
| `PRICE_STALENESS_THRESHOLD` | `24 hours` | Oracle price must be updated within this window |

---

## Common Gotchas

1. **Token price must be set before vault creation.** The token's `tokenPrice()` must return > 0 or `addBackingToken` will revert.

2. **User must approve the vault contract** to spend their space tokens before calling `redeem`. The vault calls `burnFrom(user, amount)`.

3. **Executor must approve the vault contract** to transfer backing tokens when calling `addBackingToken` with non-zero funding amounts or `addBacking`.

4. **Proportions in `redeem` must sum to exactly 10000.** Any other total will revert.

5. **Minimum backing is checked post-redemption.** If the redemption would drop total USD coverage below the threshold relative to remaining supply, it reverts with `"Redemption would breach minimum backing threshold"`.

6. **Stale oracle prices revert.** If a Chainlink feed hasn't updated in 24 hours, redemptions using that backing token will fail.

7. **`priceCurrencyFeed = address(0)` means USD.** Only set a feed address for non-USD currencies (EUR, GBP, CAD, CHF, AUD).

8. **Hypha backing tokens use `address(0)` as their price feed** in `addBackingToken`. Their price is read from `tokenPrice()` + `priceCurrencyFeed()` on the token contract, not from Chainlink.

9. **Currency feeds vs asset feeds are different things.** Currency feeds (EUR/USD, GBP/USD, etc.) are used on the token contract to define what currency the token is denominated in. Asset feeds (ETH/USD, USDC/USD, etc.) are used in the vault to price backing assets. Don't mix them up.
