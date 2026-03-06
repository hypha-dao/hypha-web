# Token Configuration Guide

## Overview

This guide explains the new advanced configuration options available for Space Tokens. These features give you fine-grained control over how your tokens behave and who can interact with them.

## New Configuration Options

### 1. Fixed vs. Adjustable Max Supply

**Parameter:** `fixedMaxSupply` (boolean)

- **When `true`:** The max supply is locked and cannot be changed after token creation
- **When `false`:** The space can update the max supply later using `setMaxSupply()`

**Use Cases:**

- Set `true` for tokens with guaranteed scarcity (e.g., ownership tokens, NFT-like tokens)
- Set `false` for tokens where supply needs may change (e.g., reward tokens, utility tokens)

**Management Function:**

```solidity
function setMaxSupply(uint256 newMaxSupply) external
```

- Only callable by the space executor
- Only works if `fixedMaxSupply` is `false`
- New max supply must be >= current total supply

---

### 2. Auto-Minting vs. Manual Minting

**Parameter:** `autoMinting` (boolean)

- **When `true`:** When the executor transfers tokens and doesn't have enough balance, tokens are automatically minted to fulfill the transfer
- **When `false`:** The executor must explicitly mint tokens first using `mint()` before transferring

**Use Cases:**

- Set `true` for convenience and gas efficiency (current behavior)
- Set `false` for explicit control over minting events and supply tracking

**Management Function:**

```solidity
function setAutoMinting(bool _autoMinting) external
```

- Only callable by the space executor

---

### 3. Transfer Whitelists

**Parameters:**

- `useTransferWhitelist` (boolean) - Enable/disable sender whitelist
- `useReceiveWhitelist` (boolean) - Enable/disable receiver whitelist

The token includes two separate whitelists:

1. **Transfer Whitelist:** Controls who can SEND tokens
2. **Receive Whitelist:** Controls who can RECEIVE tokens

**Use Cases:**

- **KYC/AML Compliance:** Only verified addresses can send/receive
- **Vesting Schedules:** Lock tokens for certain addresses
- **Access Control:** Create tiered membership systems
- **Soulbound-like Tokens:** Disable transfers except to specific addresses

**Management Functions:**

```solidity
// Batch whitelist updates (supports single or multiple addresses)
function batchSetTransferWhitelist(address[] calldata accounts, bool[] calldata allowed) external
function batchSetReceiveWhitelist(address[] calldata accounts, bool[] calldata allowed) external

// Enable/disable whitelist enforcement
function setUseTransferWhitelist(bool enabled) external
function setUseReceiveWhitelist(bool enabled) external
```

**Note:** To update a single address, just pass an array with one element:

```solidity
token.batchSetTransferWhitelist([user], [true]);  // Whitelist single user
```

**Note:** The executor is always whitelisted for both sending and receiving by default.

---

### 4. USD Pricing

**Parameter:** `priceInUSD` (uint256)

Set a price for the token in USD with 6 decimals precision.

**Examples:**

- `1000000` = $1.00
- `500000` = $0.50
- `1500000` = $1.50
- `100000000` = $100.00

**Use Cases:**

- Display price information in UIs
- Calculate payment amounts
- Integration with payment systems

**Management Function:**

```solidity
function setPriceInUSD(uint256 newPrice) external
```

- Only callable by the space executor
- Emits `PriceInUSDUpdated` event

---

### 5. Transferability

**Parameter:** `transferable` (boolean)

This existing feature now works in conjunction with the whitelist system.

- When `false`: Only the executor can transfer
- When `true`: Anyone can transfer (subject to whitelist restrictions if enabled)

**Management Function:**

```solidity
function setTransferable(bool _transferable) external
```

---

### 6. Token Burning

The space executor can now burn tokens from any address without requiring approval.

**Function:**

```solidity
function burnFrom(address from, uint256 amount) public
```

**Behavior:**

- If called by executor: Burns directly without checking approval
- If called by others: Requires approval (standard ERC20 behavior)
- Emits `TokensBurned` event

---

## Factory Deployment Parameters

### Regular Token Factory

```solidity
function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,              // 0 = unlimited
    bool transferable,               // Can non-executors transfer?
    bool fixedMaxSupply,             // Lock max supply?
    bool autoMinting,                // Auto-mint on executor transfers?
    uint256 priceInUSD,              // Price in USD (6 decimals)
    bool useTransferWhitelist,       // Enforce sender whitelist?
    bool useReceiveWhitelist         // Enforce receiver whitelist?
) public returns (address)
```

### Decaying Token Factory

Same parameters as Regular Token Factory, plus:

```solidity
uint256 decayPercentage,  // Decay % in basis points (0-10000)
uint256 decayInterval     // Decay interval in seconds
```

### Ownership Token Factory

Same parameters as Regular Token Factory, but:

- `transferable` is always `true` (only executor can initiate transfers)
- Transfers are restricted to space members only

---

## Events

All configuration updates emit events for tracking:

```solidity
event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
event TransferableUpdated(bool transferable);
event AutoMintingUpdated(bool autoMinting);
event PriceInUSDUpdated(uint256 oldPrice, uint256 newPrice);
event TransferWhitelistUpdated(address indexed account, bool canTransfer);
event ReceiveWhitelistUpdated(address indexed account, bool canReceive);
event UseTransferWhitelistUpdated(bool enabled);
event UseReceiveWhitelistUpdated(bool enabled);
event TokensBurned(address indexed burner, address indexed from, uint256 amount);
```

---

## Common Configuration Scenarios

### 1. Standard Transferable Token

```solidity
transferable: true
fixedMaxSupply: false
autoMinting: true
useTransferWhitelist: false
useReceiveWhitelist: false
```

### 2. Soulbound Token (Non-Transferable)

```solidity
transferable: false
fixedMaxSupply: true
autoMinting: true
useTransferWhitelist: false
useReceiveWhitelist: false
```

### 3. KYC/Compliance Token

```solidity
transferable: true
fixedMaxSupply: false
autoMinting: true
useTransferWhitelist: true  // Only verified can send
useReceiveWhitelist: true   // Only verified can receive
```

### 4. Fixed Supply Collectible

```solidity
transferable: true
fixedMaxSupply: true        // Lock supply at creation
autoMinting: false          // Explicit minting only
useTransferWhitelist: false
useReceiveWhitelist: false
```

### 5. Vested Reward Token

```solidity
transferable: true
fixedMaxSupply: false
autoMinting: true
useTransferWhitelist: true  // Only unlocked addresses can transfer
useReceiveWhitelist: false  // Anyone can receive
```

---

## Migration Notes

### Breaking Changes

The factory `deployToken` functions now have additional parameters. Existing deployment scripts will need to be updated.

**Before:**

```solidity
factory.deployToken(spaceId, "Token", "TKN", 1000000, true, false);
```

**After:**

```solidity
factory.deployToken(
    spaceId,
    "Token",
    "TKN",
    1000000,  // maxSupply
    true,     // transferable
    false,    // fixedMaxSupply
    true,     // autoMinting
    0,        // priceInUSD
    false,    // useTransferWhitelist
    false     // useReceiveWhitelist
);
```

### Backward Compatibility

Existing tokens are not affected. Only new tokens deployed after the upgrade will use these features.

To maintain the old behavior with new tokens, use:

- `fixedMaxSupply: false`
- `autoMinting: true`
- `useTransferWhitelist: false`
- `useReceiveWhitelist: false`

---

## Security Considerations

1. **Whitelist Management:** Only the executor can modify whitelists. Ensure executor security is paramount.

2. **Fixed Supply:** Once a token is deployed with `fixedMaxSupply: true`, this CANNOT be changed. Choose carefully.

3. **Burning:** The executor can burn tokens from any address. This is powerful but necessary for space management.

4. **Auto-Minting:** When `autoMinting: true`, the executor can effectively bypass max supply checks by transferring. Consider using `autoMinting: false` for stricter supply control.

5. **Whitelist Bypass:** The executor always bypasses whitelist checks. This ensures the space can always manage its tokens.

---

## Testing Recommendations

Before deploying to production:

1. Deploy a test token with your desired configuration
2. Test all transfer scenarios (member to member, member to non-member, etc.)
3. Test whitelist management (add, remove, batch operations)
4. Test configuration updates (max supply, price, etc.)
5. Test burning from different addresses
6. Verify events are emitted correctly

---

## Support

For questions or issues, please refer to:

- Contract source code in `/contracts`
- Test suite in `/test`
- Deployment scripts in `/scripts`
