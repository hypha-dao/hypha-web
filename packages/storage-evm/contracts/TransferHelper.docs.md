# TransferHelper Contract Documentation

## Overview

The `TransferHelper` contract is a proxy contract designed to route all ERC20 token transfers through a single whitelisted address. This solves the problem of having to manually whitelist every new token contract with gas sponsorship services like Coinbase Paymaster.

## Problem Statement

When users create token contracts on your platform:

1. Each token contract needs to be whitelisted with Coinbase (or other paymasters) to subsidize gas fees
2. Manual whitelisting for every new token is time-consuming and doesn't scale
3. You want to provide a seamless experience where gas fees are sponsored

## Solution

Deploy a single `TransferHelper` contract that:

1. Acts as a router for all token transfers
2. Only needs to be whitelisted once with Coinbase Paymaster
3. Handles token approvals and transfers on behalf of users
4. Optionally manages a whitelist of supported tokens

## Architecture

```
User -> Approve Token to TransferHelper -> TransferHelper.transferToken() -> Recipient
                                         ↓
                                   (Gas Sponsored by Coinbase)
```

## Features

### 1. Single Token Transfer

Transfer tokens from sender to recipient in one transaction.

### 2. Batch Transfers

Transfer tokens to multiple recipients in a single transaction (saves gas).

### 3. Batch Equal Transfers

Transfer equal amounts to multiple recipients.

### 4. Token Whitelist Management (Optional)

Control which tokens can be transferred through the helper.

### 5. Reentrancy Protection

Built-in protection against reentrancy attacks.

### 6. Safe Token Transfers

Uses OpenZeppelin's SafeERC20 library for secure transfers.

## Contract Functions

### Transfer Functions

#### `transferToken(address token, address to, uint256 amount)`

Transfer tokens from sender to recipient.

**Parameters:**

- `token`: The ERC20 token contract address
- `to`: The recipient address
- `amount`: The amount to transfer (in wei)

**Requirements:**

- Sender must have approved TransferHelper for at least `amount`
- Sender must have sufficient balance
- Token must be whitelisted (if whitelist is enabled)
- Recipient cannot be zero address
- Amount must be greater than 0

**Events:**

- `TransferExecuted(address indexed token, address indexed from, address indexed to, uint256 amount)`

**Example:**

```solidity
// User approves TransferHelper
token.approve(transferHelperAddress, amount);

// Execute transfer through helper
transferHelper.transferToken(tokenAddress, recipientAddress, amount);
```

#### `batchTransfer(address token, address[] recipients, uint256[] amounts)`

Transfer different amounts to multiple recipients.

**Parameters:**

- `token`: The ERC20 token contract address
- `recipients`: Array of recipient addresses
- `amounts`: Array of amounts for each recipient

**Requirements:**

- Arrays must have same length
- Arrays cannot be empty
- Total approved amount must cover sum of all transfers

**Events:**

- `TransferExecuted` (for each transfer)
- `BatchTransferExecuted(address indexed token, address indexed from, uint256 totalAmount, uint256 recipientCount)`

**Example:**

```solidity
address[] memory recipients = [0x123..., 0x456...];
uint256[] memory amounts = [100 ether, 200 ether];

transferHelper.batchTransfer(tokenAddress, recipients, amounts);
```

#### `batchTransferEqual(address token, address[] recipients, uint256 amountEach)`

Transfer equal amounts to multiple recipients.

**Parameters:**

- `token`: The ERC20 token contract address
- `recipients`: Array of recipient addresses
- `amountEach`: Amount to send to each recipient

**Example:**

```solidity
address[] memory recipients = [0x123..., 0x456..., 0x789...];
transferHelper.batchTransferEqual(tokenAddress, recipients, 100 ether);
```

### Admin Functions (Owner Only)

#### `setTokenWhitelist(address token, bool status)`

Add or remove a token from the whitelist.

**Parameters:**

- `token`: The token address
- `status`: `true` to whitelist, `false` to remove

#### `batchSetTokenWhitelist(address[] tokens, bool status)`

Whitelist multiple tokens at once.

#### `setWhitelistRequirement(bool required)`

Enable or disable the whitelist requirement.

- `required = true`: Only whitelisted tokens can be transferred
- `required = false`: All tokens can be transferred (default)

### View Functions

#### `isTokenSupported(address token)`

Check if a token can be transferred through the helper.

**Returns:** `bool` - `true` if supported, `false` otherwise

#### `supportedTokens(address token)`

Check if a specific token is whitelisted.

**Returns:** `bool`

#### `requireTokenWhitelist()`

Check if whitelist is enabled.

**Returns:** `bool`

## Deployment Guide

### 1. Deploy the Contract

```bash
npx hardhat run scripts/deploy-transfer-helper.ts --network base
```

### 2. Verify on Etherscan

```bash
npx hardhat verify --network base <TRANSFER_HELPER_ADDRESS>
```

### 3. Configure Coinbase Paymaster

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Navigate to your app → Paymaster settings
3. Add the TransferHelper contract address to the whitelist
4. Configure gas sponsorship policies

### 4. (Optional) Enable Token Whitelist

```typescript
// If you want to restrict which tokens can be transferred
await transferHelper.setWhitelistRequirement(true);

// Whitelist your tokens
await transferHelper.setTokenWhitelist(token1Address, true);
await transferHelper.setTokenWhitelist(token2Address, true);

// Or batch whitelist
await transferHelper.batchSetTokenWhitelist([token1Address, token2Address, token3Address], true);
```

## Frontend Integration

### Step 1: Add Contract Address and ABI

```typescript
export const TRANSFER_HELPER_ADDRESS = '0x...'; // Your deployed address
export const TRANSFER_HELPER_ABI = [...]; // See transfer-helper-frontend-example.ts
```

### Step 2: Approve Token Spending

Before any transfer, users must approve the TransferHelper:

```typescript
// Using wagmi
const { writeContract } = useWriteContract();

await writeContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [TRANSFER_HELPER_ADDRESS, amount],
});
```

### Step 3: Execute Transfer

```typescript
await writeContract({
  address: TRANSFER_HELPER_ADDRESS,
  abi: TRANSFER_HELPER_ABI,
  functionName: 'transferToken',
  args: [tokenAddress, recipientAddress, amount],
});
```

### Step 4: Combined Approve & Transfer (Better UX)

```typescript
const approveAndTransfer = async (tokenAddress: string, recipientAddress: string, amount: bigint) => {
  // 1. Approve
  const approveHash = await writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [TRANSFER_HELPER_ADDRESS, amount],
  });

  // 2. Wait for approval
  await waitForTransactionReceipt({ hash: approveHash });

  // 3. Transfer
  const transferHash = await writeContract({
    address: TRANSFER_HELPER_ADDRESS,
    abi: TRANSFER_HELPER_ABI,
    functionName: 'transferToken',
    args: [tokenAddress, recipientAddress, amount],
  });

  return { approveHash, transferHash };
};
```

See `transfer-helper-frontend-example.ts` for complete integration examples.

## Gas Optimization Tips

### 1. Batch Transfers

Instead of multiple single transfers, use `batchTransfer` or `batchTransferEqual`:

```typescript
// ❌ Bad: Multiple transactions
for (const recipient of recipients) {
  await transferHelper.transferToken(token, recipient, amount);
}

// ✅ Good: Single transaction
await transferHelper.batchTransferEqual(token, recipients, amount);
```

### 2. Approval Management

Check allowance before approving to avoid unnecessary transactions:

```typescript
const currentAllowance = await token.allowance(userAddress, TRANSFER_HELPER_ADDRESS);
if (currentAllowance < amount) {
  // Only approve if needed
  await token.approve(TRANSFER_HELPER_ADDRESS, amount);
}
```

### 3. Infinite Approval (Use with caution)

For frequent transfers, consider infinite approval:

```typescript
await token.approve(TRANSFER_HELPER_ADDRESS, ethers.MaxUint256);
```

⚠️ **Security Note**: Only use infinite approval if you trust the contract completely.

## Security Considerations

### 1. Reentrancy Protection

The contract uses OpenZeppelin's `ReentrancyGuard` to prevent reentrancy attacks.

### 2. SafeERC20

Uses OpenZeppelin's `SafeERC20` library to handle tokens that don't return boolean values on transfer.

### 3. Zero Address Checks

All functions validate that recipient and token addresses are not zero.

### 4. Ownership

Only the contract owner can modify whitelist settings. Make sure to transfer ownership to a secure multisig wallet in production.

### 5. Token Whitelist

Consider enabling the whitelist to restrict transfers to known, audited tokens only.

## Testing

Run the comprehensive test suite:

```bash
npx hardhat test test/TransferHelper.test.ts
```

The test suite covers:

- Single transfers
- Batch transfers
- Whitelist management
- Reentrancy protection
- Edge cases and error conditions
- Multiple token support

## Events

### TransferExecuted

```solidity
event TransferExecuted(
  address indexed token,
  address indexed from,
  address indexed to,
  uint256 amount
)
```

Emitted when a token transfer is executed.

### BatchTransferExecuted

```solidity
event BatchTransferExecuted(
  address indexed token,
  address indexed from,
  uint256 totalAmount,
  uint256 recipientCount
)
```

Emitted when a batch transfer completes.

### TokenWhitelisted

```solidity
event TokenWhitelisted(address indexed token, bool status)
```

Emitted when a token's whitelist status changes.

### WhitelistRequirementChanged

```solidity
event WhitelistRequirementChanged(bool required)
```

Emitted when the whitelist requirement is toggled.

## Upgradeability

The current implementation is **not upgradeable** to keep it simple and reduce attack surface. If you need upgradeability, consider:

1. Using UUPS or Transparent Proxy pattern
2. Adding proper access controls
3. Implementing upgrade timelock
4. Conducting thorough audits before upgrades

## Common Issues & Troubleshooting

### Issue: "Transfer failed"

**Solution:**

- Check user has sufficient token balance
- Verify user has approved TransferHelper
- Ensure token implements ERC20 standard correctly

### Issue: "Token not whitelisted"

**Solution:**

- Check if whitelist is enabled: `await transferHelper.requireTokenWhitelist()`
- Add token to whitelist: `await transferHelper.setTokenWhitelist(token, true)`

### Issue: Gas not sponsored by Coinbase

**Solution:**

- Verify TransferHelper is whitelisted in Coinbase Developer Portal
- Check paymaster configuration and gas policies
- Ensure Smart Wallet is properly configured in your frontend

### Issue: "Insufficient allowance"

**Solution:**

- Call `token.approve(transferHelper, amount)` before transferring
- Check current allowance: `await token.allowance(user, transferHelper)`

## Cost Analysis

### Gas Costs (Approximate)

| Operation                      | Gas Cost     |
| ------------------------------ | ------------ |
| Single Transfer                | ~55,000 gas  |
| Approve                        | ~46,000 gas  |
| Batch Transfer (2 recipients)  | ~75,000 gas  |
| Batch Transfer (5 recipients)  | ~135,000 gas |
| Batch Transfer (10 recipients) | ~255,000 gas |

**Savings with Batch Transfers:**

- 2 recipients: 35,000 gas saved (vs 2 single transfers)
- 5 recipients: 140,000 gas saved (vs 5 single transfers)
- 10 recipients: 295,000 gas saved (vs 10 single transfers)

## Maintenance

### Regular Tasks

1. Monitor contract events for unusual activity
2. Keep whitelist updated with new tokens
3. Review and update gas sponsorship policies in Coinbase
4. Monitor contract balance (if storing funds)

### Security Audits

Consider getting the contract audited if:

- Handling high-value transfers
- Managing a large number of tokens
- Open to the public

## License

MIT

## Support

For issues or questions:

1. Check this documentation
2. Review the test suite for examples
3. Check contract events for debugging
4. Consult Coinbase Paymaster documentation

## Version History

- **v1.0.0** (Current)
  - Initial release
  - Single and batch transfer support
  - Token whitelist management
  - Reentrancy protection
  - SafeERC20 integration
