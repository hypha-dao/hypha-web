# Changing Token Name & Symbol — Frontend Integration Guide

## Overview

All Hypha space tokens (Regular, Decaying, and Ownership) support renaming the token name and symbol after deployment. This is done through `setTokenName` and `setTokenSymbol` on the token contract.

These functions can only be called by the **space executor**, which means they must go through a **DAO proposal**.

---

## Functions

### setTokenName

```solidity
function setTokenName(string memory newName) external
```

Updates the token's display name (what `name()` returns).

- **Access:** Space executor only (via proposal)
- **Validation:** `newName` cannot be empty
- **Emits:** `TokenNameUpdated(oldName, newName)`

### setTokenSymbol

```solidity
function setTokenSymbol(string memory newSymbol) external
```

Updates the token's ticker symbol (what `symbol()` returns).

- **Access:** Space executor only (via proposal)
- **Validation:** `newSymbol` cannot be empty
- **Emits:** `TokenSymbolUpdated(oldSymbol, newSymbol)`

---

## Supported Token Types

All token types inherit from `RegularSpaceToken`, so all support renaming:

| Token Type | Contract | Supports rename |
|---|---|---|
| Regular | `RegularSpaceToken` | Yes |
| Decaying | `DecayingSpaceToken` | Yes (inherits) |
| Ownership | `OwnershipSpaceToken` | Yes (inherits) |

---

## How It Works

The token stores optional `_customName` and `_customSymbol` overrides. When set (non-empty), these override the original ERC20 `name()` and `symbol()` return values. The original values set at deployment are preserved in the ERC20 base contract but are no longer returned.

---

## Frontend Example — Encoding Proposal Data

Since only the executor can call these functions, the frontend needs to encode them as transaction data for a DAO proposal.

### Change token name

```typescript
const tokenContract = new ethers.Contract(spaceTokenAddress, tokenAbi, provider);

const callData = tokenContract.interface.encodeFunctionData("setTokenName", [
  "New Token Name"
]);

// Submit as a proposal targeting the token contract
await daoProposals.createProposal(
  spaceId,
  "Update token name to New Token Name",
  [spaceTokenAddress],  // target
  [0],                  // value (0 ETH)
  [callData]            // encoded call
);
```

### Change token symbol

```typescript
const callData = tokenContract.interface.encodeFunctionData("setTokenSymbol", [
  "NEWSYM"
]);

await daoProposals.createProposal(
  spaceId,
  "Update token symbol to NEWSYM",
  [spaceTokenAddress],
  [0],
  [callData]
);
```

### Change both in a single proposal

```typescript
const nameCallData = tokenContract.interface.encodeFunctionData("setTokenName", [
  "New Token Name"
]);
const symbolCallData = tokenContract.interface.encodeFunctionData("setTokenSymbol", [
  "NEWSYM"
]);

await daoProposals.createProposal(
  spaceId,
  "Rename token to New Token Name (NEWSYM)",
  [spaceTokenAddress, spaceTokenAddress],  // two targets (same contract)
  [0, 0],                                  // two values
  [nameCallData, symbolCallData]           // two calls
);
```

---

## Events

| Event | Fields | Description |
|---|---|---|
| `TokenNameUpdated` | `string oldName, string newName` | Emitted when token name changes |
| `TokenSymbolUpdated` | `string oldSymbol, string newSymbol` | Emitted when token symbol changes |

---

## Common Gotchas

1. **Executor only.** Direct calls from a regular wallet will revert with `"Only executor can update token name/symbol"`. These must go through a DAO proposal.

2. **Cannot set empty strings.** Both name and symbol must be non-empty or the call reverts.

3. **Immediate effect.** Once the proposal executes, `name()` and `symbol()` immediately return the new values. Any frontend or indexer reading these should reflect the change.

4. **On-chain only.** Block explorers and token lists may cache the old name/symbol. Basescan and similar tools may take time to reflect the update.
