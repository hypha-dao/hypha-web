# TransferHelper Integration Guide

This guide shows you how to integrate the TransferHelper contract into your existing token creation flow.

## Overview

Your current flow:

```
User creates space → Token Factory deploys token → Users transfer tokens (gas not sponsored)
```

New flow with TransferHelper:

```
User creates space → Token Factory deploys token → [Optional: Register with TransferHelper] → Users transfer via TransferHelper (gas sponsored!)
```

## Integration Steps

### Step 1: Deploy TransferHelper

```bash
npx hardhat run scripts/deploy-transfer-helper.ts --network base
```

Save the deployed address - you'll need it for:

1. Coinbase Paymaster whitelist
2. Frontend configuration
3. Backend API calls

### Step 2: Configure Coinbase Paymaster

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Navigate to Paymaster settings
3. Add TransferHelper contract address to whitelist
4. Set gas sponsorship policies (e.g., max gas per tx, daily limits)

### Step 3: Backend API Integration

Add TransferHelper support to your token creation API:

```typescript
// File: apps/api/src/routes/tokens.ts (example)

import { registerTokenWithHelper } from '@packages/storage-evm/scripts/register-token-with-helper';

interface CreateTokenRequest {
  spaceId: number;
  name: string;
  symbol: string;
  maxSupply: number;
  transferable: boolean;
  isVotingToken: boolean;
}

async function createToken(req: CreateTokenRequest) {
  // 1. Deploy token using your existing factory
  const tokenAddress = await deployTokenViaFactory(req.spaceId, req.name, req.symbol, req.maxSupply, req.transferable, req.isVotingToken);

  // 2. Optional: Register with TransferHelper (only if whitelist is enabled)
  const TRANSFER_HELPER_ADDRESS = process.env.TRANSFER_HELPER_ADDRESS;
  if (TRANSFER_HELPER_ADDRESS) {
    try {
      await registerTokenWithHelper(tokenAddress, TRANSFER_HELPER_ADDRESS);
      console.log(`Token ${tokenAddress} registered with TransferHelper`);
    } catch (error) {
      // Log error but don't fail token creation
      console.error('Failed to register token with TransferHelper:', error);
    }
  }

  // 3. Store token info in database
  await db.tokens.create({
    address: tokenAddress,
    spaceId: req.spaceId,
    name: req.name,
    symbol: req.symbol,
    // ... other fields
  });

  return { tokenAddress };
}
```

### Step 4: Frontend Integration

#### Option A: Using wagmi (Recommended)

Create a custom hook for token transfers:

```typescript
// File: apps/web/src/hooks/useTokenTransfer.ts

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

const TRANSFER_HELPER_ADDRESS = '0x...'; // Your deployed address

export function useTokenTransfer() {
  const { writeContractAsync } = useWriteContract();

  const transferTokens = async (tokenAddress: string, recipientAddress: string, amount: string, decimals: number = 18) => {
    const amountWei = parseUnits(amount, decimals);

    // 1. Approve TransferHelper to spend tokens
    const approveHash = await writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [TRANSFER_HELPER_ADDRESS as `0x${string}`, amountWei],
    });

    // 2. Wait for approval
    await waitForTransactionReceipt({ hash: approveHash });

    // 3. Execute transfer via TransferHelper
    const transferHash = await writeContractAsync({
      address: TRANSFER_HELPER_ADDRESS as `0x${string}`,
      abi: [
        {
          name: 'transferToken',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'token', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [],
        },
      ],
      functionName: 'transferToken',
      args: [tokenAddress as `0x${string}`, recipientAddress as `0x${string}`, amountWei],
    });

    return { approveHash, transferHash };
  };

  return { transferTokens };
}
```

Use in your component:

```typescript
// File: apps/web/src/app/space/[id]/transfer/page.tsx

'use client';

import { useState } from 'react';
import { useTokenTransfer } from '@/hooks/useTokenTransfer';

export default function TransferPage() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { transferTokens } = useTokenTransfer();

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await transferTokens(tokenAddress, recipient, amount);
      alert('Transfer successful! Hash: ' + result.transferHash);
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleTransfer}>
      <input value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} placeholder="Token Address" required />
      <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient Address" required />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" type="number" step="0.000001" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Transfer'}
      </button>
    </form>
  );
}
```

#### Option B: Direct Coinbase Smart Wallet Integration

If you're using Coinbase Smart Wallet exclusively:

```typescript
// File: apps/web/src/lib/wagmi-config.ts

import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Your Hypha App',
      preference: 'smartWalletOnly', // Only Smart Wallet (with paymaster)
    }),
  ],
  // ... rest of config
});
```

### Step 5: Update Your UI Components

Replace direct token transfers with TransferHelper transfers in your existing components:

**Before:**

```typescript
// ❌ Old way - direct token transfer (gas not sponsored)
await tokenContract.transfer(recipient, amount);
```

**After:**

```typescript
// ✅ New way - transfer via helper (gas sponsored!)
await tokenContract.approve(TRANSFER_HELPER_ADDRESS, amount);
await transferHelper.transferToken(tokenAddress, recipient, amount);
```

### Step 6: Batch Transfers for Airdrops

If you have airdrop or bulk distribution features:

```typescript
// File: apps/web/src/hooks/useBatchTransfer.ts

export function useBatchTransfer() {
  const { writeContractAsync } = useWriteContract();

  const batchTransfer = async (tokenAddress: string, recipients: string[], amounts: bigint[]) => {
    // 1. Calculate total amount
    const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0n);

    // 2. Approve total amount
    await writeContractAsync({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [TRANSFER_HELPER_ADDRESS, totalAmount],
    });

    // 3. Batch transfer
    const hash = await writeContractAsync({
      address: TRANSFER_HELPER_ADDRESS as `0x${string}`,
      abi: TRANSFER_HELPER_ABI,
      functionName: 'batchTransfer',
      args: [tokenAddress, recipients, amounts],
    });

    return hash;
  };

  return { batchTransfer };
}
```

## Environment Variables

Add to your `.env` files:

```bash
# .env.local (for apps/web)
NEXT_PUBLIC_TRANSFER_HELPER_ADDRESS=0x...

# .env (for backend)
TRANSFER_HELPER_ADDRESS=0x...
```

## Testing Your Integration

### 1. Test Single Transfer

```bash
# Deploy a test token
npx hardhat run scripts/deploy-test-token.ts --network base-sepolia

# Test transfer via helper
npx hardhat run scripts/test-transfer-helper.ts --network base-sepolia
```

### 2. Test in Frontend

1. Create a test space
2. Deploy a token for the space
3. Try transferring tokens to another address
4. Verify gas was sponsored (check transaction in block explorer)

### 3. Verify Gas Sponsorship

In BaseScan (or your block explorer):

- Look at the transaction
- Check the "Gas Used" section
- Should show "Sponsored by Coinbase Paymaster" or similar

## Monitoring & Analytics

Track TransferHelper usage:

```typescript
// Listen to TransferExecuted events
const transferHelper = new ethers.Contract(TRANSFER_HELPER_ADDRESS, TRANSFER_HELPER_ABI, provider);

transferHelper.on('TransferExecuted', (token, from, to, amount, event) => {
  console.log('Transfer executed:', {
    token,
    from,
    to,
    amount: ethers.formatEther(amount),
    txHash: event.transactionHash,
  });

  // Store in analytics/database
  trackTransferEvent({
    token,
    from,
    to,
    amount,
    timestamp: Date.now(),
  });
});
```

## Troubleshooting

### Issue: Transfers not being sponsored

**Checklist:**

1. ✅ TransferHelper is whitelisted in Coinbase Developer Portal
2. ✅ User is using Coinbase Smart Wallet
3. ✅ Paymaster policies are configured correctly
4. ✅ Gas limit is within sponsored range
5. ✅ User has approved TransferHelper

**Debug:**

```typescript
// Check approval
const allowance = await token.allowance(userAddress, TRANSFER_HELPER_ADDRESS);
console.log('Allowance:', allowance.toString());

// Check token support
const isSupported = await transferHelper.isTokenSupported(tokenAddress);
console.log('Token supported:', isSupported);
```

### Issue: Token not whitelisted

If you enabled the whitelist:

```typescript
// Check whitelist status
const required = await transferHelper.requireTokenWhitelist();
const supported = await transferHelper.supportedTokens(tokenAddress);

console.log('Whitelist required:', required);
console.log('Token whitelisted:', supported);

// Add token to whitelist
if (required && !supported) {
  await transferHelper.setTokenWhitelist(tokenAddress, true);
}
```

## Migration Strategy

If you already have live tokens and want to migrate:

### Phase 1: Deploy & Test

1. Deploy TransferHelper to testnet
2. Test with existing token contracts
3. Verify Coinbase integration works

### Phase 2: Production Deployment

1. Deploy TransferHelper to mainnet
2. Whitelist with Coinbase Paymaster
3. Don't enable token whitelist yet (allow all tokens)

### Phase 3: Frontend Update

1. Add TransferHelper support to frontend
2. Keep old transfer method as fallback
3. Gradually roll out to users

### Phase 4: Full Migration

1. Monitor usage and gas savings
2. Enable token whitelist (optional)
3. Remove old transfer method
4. Update documentation

## Cost Savings

Estimated gas savings with TransferHelper + Coinbase Paymaster:

| Action                | Without Helper | With Helper + Paymaster | Savings |
| --------------------- | -------------- | ----------------------- | ------- |
| Single Transfer       | ~$0.50         | $0.00 (sponsored)       | 100%    |
| 5 Transfers           | ~$2.50         | $0.00 (sponsored)       | 100%    |
| Batch (10 recipients) | ~$5.00         | $0.00 (sponsored)       | 100%    |

**Monthly savings** (assuming 1000 transfers/month):

- Before: ~$500/month in gas fees (paid by users)
- After: ~$500/month in gas fees (sponsored by Coinbase Paymaster)
- User benefit: **100% gas savings!**

## Best Practices

1. **Always check allowance before approving again**

   - Saves unnecessary approval transactions

2. **Use batch transfers for airdrops**

   - More efficient than individual transfers
   - Users save time and gas

3. **Keep whitelist disabled initially**

   - Enable only if you need to restrict tokens
   - Easier to manage

4. **Monitor TransferHelper events**

   - Track usage patterns
   - Identify popular tokens
   - Detect anomalies

5. **Have a backup plan**
   - Keep direct transfer as fallback
   - In case Coinbase Paymaster is down
   - Or user doesn't have Smart Wallet

## Next Steps

1. ✅ Deploy TransferHelper
2. ✅ Configure Coinbase Paymaster
3. ✅ Update backend API
4. ✅ Update frontend components
5. ✅ Test thoroughly
6. ✅ Deploy to production
7. ✅ Monitor and optimize

## Support

For questions or issues:

- Check `TransferHelper.docs.md` for detailed documentation
- Review test files for examples
- Check Coinbase Paymaster documentation
- Contact Coinbase support for paymaster issues

## Additional Resources

- [TransferHelper Contract](./TransferHelper.sol)
- [Test Suite](../test/TransferHelper.test.ts)
- [Deployment Script](./deploy-transfer-helper.ts)
- [Frontend Examples](./transfer-helper-frontend-example.ts)
- [Token Registration](./register-token-with-helper.ts)
- [Full Documentation](../contracts/TransferHelper.docs.md)
