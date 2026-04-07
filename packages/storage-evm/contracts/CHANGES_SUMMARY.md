# Token Contracts Update Summary

## Overview

This document summarizes the changes made to the token contracts and factories to add advanced configuration options for token management.

## Files Modified

### Token Contracts

1. **RegularSpaceToken.sol** - Base token implementation
2. **DecayingSpaceToken.sol** - Token with decay mechanism
3. **OwnershipSpaceToken.sol** - Membership-restricted token

### Factory Contracts

4. **RegularTokenFactory.sol** - Regular token deployment
5. **DecayingTokenFactory.sol** - Decaying token deployment
6. **OwnershipTokenFactory.sol** - Ownership token deployment

### Interface Contracts

7. **IRegularTokenFactory.sol** - Interface updated
8. **IDecayingTokenFactory.sol** - Interface updated
9. **IOwnershipTokenFactory.sol** - Interface updated

### Documentation

10. **TOKEN_CONFIGURATION_GUIDE.md** - New comprehensive guide

---

## Feature Additions

### 1. Fixed vs. Adjustable Max Supply

**New Storage Variable:**

```solidity
bool public fixedMaxSupply;
```

**New Function:**

```solidity
function setMaxSupply(uint256 newMaxSupply) external virtual
```

**Behavior:**

- If `fixedMaxSupply` is `true`, max supply cannot be changed after deployment
- If `false`, executor can update max supply using `setMaxSupply()`
- Validates new max supply is >= current total supply

---

### 2. Auto-Minting Control

**New Storage Variable:**

```solidity
bool public autoMinting;
```

**New Function:**

```solidity
function setAutoMinting(bool _autoMinting) external virtual
```

**Behavior:**

- When `true`: Executor transfers auto-mint if insufficient balance (previous behavior)
- When `false`: Must explicitly call `mint()` before transferring
- Updated in both `transfer()` and `transferFrom()` functions

---

### 3. Transfer & Receive Whitelists

**New Storage Variables:**

```solidity
mapping(address => bool) public canTransfer;
mapping(address => bool) public canReceive;
bool public useTransferWhitelist;
bool public useReceiveWhitelist;
```

**New Functions:**

```solidity
function batchSetTransferWhitelist(address[] calldata accounts, bool[] calldata allowed) external virtual
function batchSetReceiveWhitelist(address[] calldata accounts, bool[] calldata allowed) external virtual
function setUseTransferWhitelist(bool enabled) external virtual
function setUseReceiveWhitelist(bool enabled) external virtual
```

**Behavior:**

- Two independent whitelists for senders and receivers
- Checked in both `transfer()` and `transferFrom()`
- Executor is always whitelisted by default
- Can be toggled on/off without losing whitelist data

---

### 4. USD Pricing

**New Storage Variable:**

```solidity
uint256 public priceInUSD; // 6 decimals precision
```

**New Function:**

```solidity
function setPriceInUSD(uint256 newPrice) external virtual
```

**Behavior:**

- Stores token price in USD with 6 decimal places
- Can be updated by executor at any time
- Useful for payment calculations and UI display

---

### 5. Enhanced Burning

**Updated Function:**

```solidity
function burnFrom(address from, uint256 amount) public virtual override
```

**Behavior:**

- Executor can burn from any address without approval
- Other addresses still require approval (ERC20 standard)
- Emits `TokensBurned` event

---

### 6. Additional Configuration

**New Function:**

```solidity
function setTransferable(bool _transferable) external virtual
```

**Behavior:**

- Allows updating transferable status after deployment
- Previously this was only settable at deployment

---

## New Events

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

## Factory Function Updates

### RegularTokenFactory.deployToken()

**Old Signature:**

```solidity
function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool isVotingToken
) public returns (address)
```

**New Signature:**

```solidity
function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool fixedMaxSupply,        // NEW
    bool autoMinting,            // NEW
    uint256 priceInUSD,          // NEW
    bool useTransferWhitelist,   // NEW
    bool useReceiveWhitelist     // NEW
) public returns (address)
```

### DecayingTokenFactory.deployDecayingToken()

**New Parameters Added:**

- `bool fixedMaxSupply`
- `bool autoMinting`
- `uint256 priceInUSD`
- `bool useTransferWhitelist`
- `bool useReceiveWhitelist`

### OwnershipTokenFactory.deployOwnershipToken()

**New Parameters Added:**

- `bool fixedMaxSupply`
- `bool autoMinting`
- `uint256 priceInUSD`
- `bool useTransferWhitelist`
- `bool useReceiveWhitelist`

---

## Implementation Details

### Transfer Function Updates

**Before:**

```solidity
function transfer(address to, uint256 amount) public virtual override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == executor, 'Token transfers are disabled');

    if (sender == executor) {
        if (balanceOf(sender) < amount) {
            uint256 amountToMint = amount - balanceOf(sender);
            mint(sender, amountToMint);
        }
    }

    _transfer(sender, to, amount);
    return true;
}
```

**After:**

```solidity
function transfer(address to, uint256 amount) public virtual override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == executor, 'Token transfers are disabled');

    // Check transfer whitelist
    if (useTransferWhitelist) {
        require(canTransfer[sender], 'Sender not whitelisted to transfer');
    }

    // Check receive whitelist
    if (useReceiveWhitelist) {
        require(canReceive[to], 'Recipient not whitelisted to receive');
    }

    // If executor is transferring and auto-minting is enabled
    if (sender == executor && autoMinting) {
        if (balanceOf(sender) < amount) {
            uint256 amountToMint = amount - balanceOf(sender);
            mint(sender, amountToMint);
        }
    }

    _transfer(sender, to, amount);
    return true;
}
```

Similar updates were made to `transferFrom()`.

---

## Initialization Updates

All token contracts now accept additional parameters in their `initialize()` functions:

**RegularSpaceToken.initialize():**

```solidity
function initialize(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable,
    bool _fixedMaxSupply,        // NEW
    bool _autoMinting,            // NEW
    uint256 _priceInUSD,          // NEW
    bool _useTransferWhitelist,   // NEW
    bool _useReceiveWhitelist     // NEW
) public initializer
```

**DecayingSpaceToken.initialize():**

- Inherits all new parameters from RegularSpaceToken
- Plus existing decay parameters

**OwnershipSpaceToken.initialize():**

- Inherits all new parameters from RegularSpaceToken
- Plus existing spacesContract parameter

---

## Storage Layout

New storage variables are appended to maintain upgrade compatibility:

```solidity
// Existing storage
uint256 public spaceId;
uint256 public maxSupply;
bool public transferable;
address public executor;
address public transferHelper;

// New storage (appended)
bool public fixedMaxSupply;
bool public autoMinting;
uint256 public priceInUSD;
mapping(address => bool) public canTransfer;
mapping(address => bool) public canReceive;
bool public useTransferWhitelist;
bool public useReceiveWhitelist;
```

---

## Access Control

All new management functions are restricted to the executor:

- `setMaxSupply()` - Executor only
- `setTransferable()` - Executor only
- `setAutoMinting()` - Executor only
- `setPriceInUSD()` - Executor only
- `setTransferWhitelist()` - Executor only
- `setReceiveWhitelist()` - Executor only
- `setUseTransferWhitelist()` - Executor only
- `setUseReceiveWhitelist()` - Executor only
- `burnFrom()` - Anyone with approval, or executor without approval

---

## Backward Compatibility

### Existing Tokens

- Not affected by these changes
- Continue to work as before

### New Tokens

To replicate old behavior, use these parameters:

```solidity
fixedMaxSupply: false
autoMinting: true
useTransferWhitelist: false
useReceiveWhitelist: false
```

---

## Testing Recommendations

1. **Unit Tests:**

   - Test each new function individually
   - Test whitelist enforcement in transfers
   - Test auto-minting on/off behavior
   - Test fixed max supply enforcement
   - Test executor burn functionality

2. **Integration Tests:**

   - Deploy tokens with various configurations
   - Test configuration updates
   - Test batch whitelist operations
   - Test event emissions

3. **Edge Cases:**
   - Try to update fixed max supply (should fail)
   - Test transfers with whitelists disabled then enabled
   - Test burning with and without approval
   - Test auto-minting with insufficient balance

---

## Deployment Checklist

- [ ] Compile all contracts
- [ ] Run full test suite
- [ ] Deploy new token implementations
- [ ] Upgrade factory contracts
- [ ] Update frontend to support new parameters
- [ ] Update API documentation
- [ ] Migrate existing deployment scripts
- [ ] Test on testnet
- [ ] Deploy to mainnet

---

## Breaking Changes

### For Contract Callers

- Factory `deployToken()` functions have new required parameters
- Existing deployment scripts MUST be updated

### For Contract Developers

- Token initialize functions have new parameters
- Factory interfaces have been updated

### No Breaking Changes For

- Existing deployed tokens
- Standard ERC20 functionality
- Token holders
- Basic transfer operations

---

## Future Considerations

Potential future enhancements:

1. Time-locked configuration changes
2. Multi-sig governance for critical functions
3. Dynamic pricing oracles
4. Role-based access control beyond executor
5. Automatic whitelist synchronization with space membership

---

## Support & Resources

- **Configuration Guide:** See `TOKEN_CONFIGURATION_GUIDE.md`
- **Source Code:** `/contracts` directory
- **Interfaces:** `/contracts/interfaces` directory
- **Tests:** `/test` directory (to be created)
- **Scripts:** `/scripts` directory

---

## Version Information

- **Version:** 2.0.0
- **Date:** November 12, 2025
- **Breaking Changes:** Yes (factory function signatures)
- **Storage Layout Changes:** Yes (new variables appended)
- **Upgrade Safe:** Yes (for existing tokens via proxy pattern)
