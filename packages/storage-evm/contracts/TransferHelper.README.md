# TransferHelper - Quick Start

A proxy contract that routes all token transfers through a single whitelisted address, enabling gas-free transfers via Coinbase Paymaster.

## The Problem

❌ **Before:**

- Users create token contracts on your platform
- Each token needs manual whitelisting with Coinbase to sponsor gas
- Doesn't scale with many tokens
- Poor user experience

✅ **After:**

- Deploy one TransferHelper contract
- Whitelist it once with Coinbase
- All token transfers route through it
- Automatic gas sponsorship for all transfers

## Quick Start (5 minutes)

### 1. Deploy Contract

```bash
npx hardhat run scripts/deploy-transfer-helper.ts --network base
# Copy the deployed address
```

### 2. Whitelist with Coinbase

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Add TransferHelper address to Paymaster whitelist
3. Done! ✅

### 3. Frontend Integration

```typescript
// Approve TransferHelper to spend tokens
await tokenContract.approve(TRANSFER_HELPER_ADDRESS, amount);

// Transfer via helper (gas-free!)
await transferHelper.transferToken(tokenAddress, recipient, amount);
```

That's it! Transfers are now subsidized.

## Key Features

| Feature                     | Description                                |
| --------------------------- | ------------------------------------------ |
| 🔄 **Single Transfer**      | Transfer tokens from sender to recipient   |
| 📦 **Batch Transfer**       | Transfer to multiple recipients (save gas) |
| 🔐 **Optional Whitelist**   | Restrict which tokens can be transferred   |
| 🛡️ **Reentrancy Protected** | Built-in security measures                 |
| 💰 **Gas Savings**          | 100% gas savings with Coinbase Paymaster   |

## Usage Examples

### Single Transfer

```typescript
// JavaScript/TypeScript
const tx = await transferHelper.transferToken(
  '0x...', // token address
  '0x...', // recipient
  ethers.parseEther('100'), // amount
);
```

### Batch Transfer (Airdrop)

```typescript
const recipients = ['0x123...', '0x456...', '0x789...'];
const amounts = [ethers.parseEther('100'), ethers.parseEther('200'), ethers.parseEther('150')];

await transferHelper.batchTransfer(tokenAddress, recipients, amounts);
```

### Equal Batch Transfer

```typescript
const recipients = ['0x123...', '0x456...', '0x789...'];
const amountEach = ethers.parseEther('100');

await transferHelper.batchTransferEqual(tokenAddress, recipients, amountEach);
```

## Contract Interface

```solidity
interface ITransferHelper {
  // Transfer single amount
  function transferToken(
    address token,
    address to,
    uint256 amount
  ) external;

  // Transfer different amounts to multiple recipients
  function batchTransfer(
    address token,
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external;

  // Transfer equal amount to multiple recipients
  function batchTransferEqual(
    address token,
    address[] calldata recipients,
    uint256 amountEach
  ) external;

  // Check if token is supported
  function isTokenSupported(address token) external view returns (bool);
}
```

## File Structure

```
packages/storage-evm/
├── contracts/
│   ├── TransferHelper.sol                          # Main contract
│   ├── TransferHelper.docs.md                      # Full documentation
│   └── TransferHelper.README.md                    # This file
├── test/
│   └── TransferHelper.test.ts                      # Comprehensive tests
└── scripts/
    ├── deploy-transfer-helper.ts                   # Deployment script
    ├── register-token-with-helper.ts               # Token registration
    ├── transfer-helper-frontend-example.ts         # Frontend examples
    └── INTEGRATION_GUIDE.md                        # Integration guide
```

## Documentation

- 📖 **Full Documentation**: [TransferHelper.docs.md](./TransferHelper.docs.md)
- 🔧 **Integration Guide**: [../scripts/INTEGRATION_GUIDE.md](../scripts/INTEGRATION_GUIDE.md)
- 💻 **Frontend Examples**: [../scripts/transfer-helper-frontend-example.ts](../scripts/transfer-helper-frontend-example.ts)
- ✅ **Tests**: [../test/TransferHelper.test.ts](../test/TransferHelper.test.ts)

## Testing

```bash
# Run all tests
npx hardhat test test/TransferHelper.test.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test test/TransferHelper.test.ts

# Run specific test
npx hardhat test test/TransferHelper.test.ts --grep "Single Token Transfer"
```

## Common Commands

```bash
# Deploy to testnet
npx hardhat run scripts/deploy-transfer-helper.ts --network base-sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy-transfer-helper.ts --network base

# Verify contract
npx hardhat verify --network base <ADDRESS>

# Register a token (if whitelist enabled)
npx hardhat run scripts/register-token-with-helper.ts --network base
```

## Configuration

### Optional: Enable Token Whitelist

By default, all tokens can be transferred. To restrict:

```typescript
// Enable whitelist
await transferHelper.setWhitelistRequirement(true);

// Whitelist specific tokens
await transferHelper.setTokenWhitelist('0x...', true);

// Or batch whitelist
await transferHelper.batchSetTokenWhitelist(['0x...', '0x...', '0x...'], true);
```

### Environment Variables

```bash
# .env
TRANSFER_HELPER_ADDRESS=0x...  # Deployed contract address
```

## Security

- ✅ Uses OpenZeppelin's SafeERC20
- ✅ Reentrancy protection (ReentrancyGuard)
- ✅ Owner-only admin functions
- ✅ Input validation on all functions
- ✅ No upgradeable proxy (immutable, secure)

## Gas Costs

| Operation           | Gas Cost | With Coinbase Paymaster |
| ------------------- | -------- | ----------------------- |
| Approve             | ~46,000  | Depends on your policy  |
| Single Transfer     | ~55,000  | $0 (sponsored)          |
| Batch 5 Recipients  | ~135,000 | $0 (sponsored)          |
| Batch 10 Recipients | ~255,000 | $0 (sponsored)          |

## Architecture Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1. Approve tokens
       ↓
┌─────────────────┐
│  ERC20 Token    │
└─────────────────┘
       │
       │ 2. TransferHelper.transferToken()
       ↓
┌──────────────────────┐
│  TransferHelper      │  ← Whitelisted with Coinbase
│  (Gas Sponsored)     │
└──────────────────────┘
       │
       │ 3. transferFrom(user, recipient, amount)
       ↓
┌─────────────────┐
│   Recipient     │
└─────────────────┘
```

## Integration Checklist

- [ ] Deploy TransferHelper contract
- [ ] Save deployed address
- [ ] Whitelist with Coinbase Paymaster
- [ ] Add address to frontend config
- [ ] Update transfer logic to use TransferHelper
- [ ] Add approval step before transfers
- [ ] Test on testnet
- [ ] Deploy to production
- [ ] Monitor transactions

## Benefits

1. **One-time setup**: Deploy and whitelist once, use forever
2. **Gas savings**: 100% gas sponsorship for users
3. **Batch transfers**: Save even more gas with batch operations
4. **Flexible**: Optional token whitelist for security
5. **Battle-tested**: Uses OpenZeppelin contracts
6. **Well-documented**: Complete documentation and examples

## Support & Resources

- 📚 [Full Documentation](./TransferHelper.docs.md)
- 🔧 [Integration Guide](../scripts/INTEGRATION_GUIDE.md)
- 💻 [Frontend Examples](../scripts/transfer-helper-frontend-example.ts)
- 🧪 [Test Suite](../test/TransferHelper.test.ts)
- 🚀 [Deployment Script](../scripts/deploy-transfer-helper.ts)
- 📝 [Token Registration](../scripts/register-token-with-helper.ts)

## License

MIT

---

**Ready to get started?** Run:

```bash
npx hardhat run scripts/deploy-transfer-helper.ts --network base
```

Then follow the on-screen instructions! 🚀
