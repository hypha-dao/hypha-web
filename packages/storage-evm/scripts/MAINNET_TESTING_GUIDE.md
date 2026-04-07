# Mainnet Testing Guide (Without Gas Sponsorship)

This guide walks you through testing TransferHelper on mainnet using scripts, **before** setting up Coinbase Paymaster integration.

## Why Test Without Gas Sponsorship First?

1. ✅ **Verify core functionality** works correctly
2. ✅ **Test with real tokens** on mainnet
3. ✅ **Confirm gas costs** and transaction patterns
4. ✅ **Debug any issues** before adding complexity
5. ✅ **Build confidence** before Coinbase integration

## Prerequisites

Before you start:

- [ ] Wallet with mainnet ETH (for gas)
- [ ] Test tokens deployed (or use existing tokens)
- [ ] Private key configured in Hardhat
- [ ] Hardhat configured for mainnet

## Step-by-Step Testing Process

### Step 1: Verify Hardhat Configuration

Make sure your `hardhat.config.ts` has the Base network configured:

```typescript
networks: {
  base: {
    url: 'https://mainnet.base.org',
    accounts: [process.env.PRIVATE_KEY], // Set in your .env
  },
}
```

And your `.env` has:

```bash
PRIVATE_KEY=your_private_key_here
```

### Step 2: Deploy TransferHelper

```bash
# Deploy to mainnet
npx hardhat run scripts/deploy-transfer-helper.ts --network base

# Expected output:
# ✅ TransferHelper deployed successfully!
# TransferHelper address: 0x...
```

**Save the address!** You'll need it for the next steps.

### Step 3: Verify Contract (Optional but Recommended)

```bash
# Verify on BaseScan
npx hardhat verify --network base <TRANSFER_HELPER_ADDRESS>

# Check on BaseScan:
# https://basescan.org/address/<TRANSFER_HELPER_ADDRESS>
```

### Step 4: Prepare Test Token

You have two options:

#### Option A: Deploy a New Test Token

If you want to deploy a fresh token for testing:

```bash
# Deploy via your token factory
# Or use a simple ERC20 token for testing
```

#### Option B: Use Existing Token

If you already have tokens deployed, just use that address. Make sure you own some of these tokens!

### Step 5: Configure and Run Single Transfer Test

Open `scripts/test-transfer-helper-mainnet.ts` and update the configuration at the top:

```typescript
// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: TestConfig = {
  // Your deployed TransferHelper address (from Step 2)
  transferHelperAddress: '0x1234...', // ← Replace with your address

  // Token to test with (use your deployed token or any ERC20)
  testTokenAddress: '0x5678...', // ← Replace with token address

  // Address to send test transfer to (use a wallet you control)
  recipientAddress: '0x9abc...', // ← Replace with recipient address

  // Amount to transfer (in token units)
  transferAmount: '1', // Transfer 1 token
};
// ============================================================================
```

Then run the test:

```bash
npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base
```

**Expected output:**

```
🧪 Testing TransferHelper on Mainnet
═══════════════════════════════════════════════════════

📋 Configuration:
─────────────────────────────────────────────────────
Network: base
Signer: 0x...
Balance: 0.5 ETH
TransferHelper: 0x...
Test Token: 0x...
Recipient: 0x...

🪙 Token Information:
─────────────────────────────────────────────────────
Name: Test Token
Symbol: TEST
Decimals: 18

💰 Initial Balances:
─────────────────────────────────────────────────────
Sender: 100.0 TEST
Recipient: 0.0 TEST

🔍 TransferHelper Status:
─────────────────────────────────────────────────────
Owner: 0x...
Whitelist Required: false
Token Supported: true

📝 Step 1: Checking Allowance
─────────────────────────────────────────────────────
Current Allowance: 0.0 TEST
Needs Approval: true

✍️  Step 2: Approving TransferHelper
─────────────────────────────────────────────────────
Approval TX: 0x...
Waiting for confirmation...
✅ Approved! Block: 12345678
Gas Used: 46123

🚀 Step 3: Executing Transfer via TransferHelper
─────────────────────────────────────────────────────
Transferring: 1 TEST
From: 0x...
To: 0x...

Transfer TX: 0x...
Waiting for confirmation...
✅ Transfer successful! Block: 12345679
Gas Used: 54321

📊 Event: TransferExecuted
Token: 0x...
From: 0x...
To: 0x...
Amount: 1.0 TEST

✅ Step 4: Verifying Final Balances
─────────────────────────────────────────────────────
Sender: 99.0 TEST
Recipient: 1.0 TEST

Changes:
Sender: 1.0 TEST (sent)
Recipient: 1.0 TEST (received)

═══════════════════════════════════════════════════════
🎉 TEST COMPLETED SUCCESSFULLY!
═══════════════════════════════════════════════════════

✅ TransferHelper is working correctly
✅ Tokens were transferred successfully
✅ Ready to integrate with Coinbase Paymaster for gas sponsorship
```

### Step 6: Configure and Run Batch Transfer Test

Open `scripts/test-batch-transfer-mainnet.ts` and update the configuration:

```typescript
// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: BatchTestConfig = {
  // Your deployed TransferHelper address
  transferHelperAddress: '0x1234...',

  // Token to test with
  testTokenAddress: '0x5678...',

  // Multiple recipients for batch transfer (add as many as you want)
  recipients: [
    '0xaaaa...', // Recipient 1
    '0xbbbb...', // Recipient 2
    '0xcccc...', // Recipient 3
  ],

  // Amounts for each recipient (must match number of recipients)
  amounts: ['1', '2', '3'], // Will send 1, 2, and 3 tokens respectively
};
// ============================================================================
```

Then run the batch test:

```bash
npx hardhat run scripts/test-batch-transfer-mainnet.ts --network base
```

**Expected output:**

```
🧪 Testing Batch Transfer on Mainnet
═══════════════════════════════════════════════════════

📊 Batch Transfer Details:
─────────────────────────────────────────────────────
1. 0x...: 1 TEST
2. 0x...: 2 TEST
3. 0x...: 3 TEST

Total Amount: 6.0 TEST

💰 Sender Balance: 99.0 TEST

📊 Initial Recipient Balances:
─────────────────────────────────────────────────────
1. 0.0 TEST
2. 0.0 TEST
3. 0.0 TEST

📝 Current Allowance: 0.0 TEST
✍️  Approving TransferHelper...
Approval TX: 0x...
✅ Approved!

🚀 Executing Batch Transfer...
─────────────────────────────────────────────────────
Transfer TX: 0x...
Waiting for confirmation...
✅ Batch transfer successful! Block: 12345680
Gas Used: 134567

Transfer 1:
  To: 0x...
  Amount: 1.0 TEST
Transfer 2:
  To: 0x...
  Amount: 2.0 TEST
Transfer 3:
  To: 0x...
  Amount: 3.0 TEST

📊 Batch Summary:
  Total Amount: 6.0 TEST
  Recipients: 3

✅ Final Recipient Balances:
─────────────────────────────────────────────────────
1. 1.0 TEST (+1.0)
2. 2.0 TEST (+2.0)
3. 3.0 TEST (+3.0)

Sender Final Balance: 93.0 TEST
Total Sent: 6.0 TEST

═══════════════════════════════════════════════════════
🎉 BATCH TRANSFER TEST COMPLETED!
═══════════════════════════════════════════════════════

✅ All transfers successful
✅ Gas savings compared to individual transfers
✅ Ready for production use
```

## Troubleshooting

### Issue: "Insufficient balance"

**Solution:**

- Make sure you have tokens in your wallet
- Check token balance: `cast call $TEST_TOKEN_ADDRESS "balanceOf(address)(uint256)" $YOUR_ADDRESS --rpc-url $BASE_RPC_URL`
- Mint tokens if needed (via your token factory)

### Issue: "Token not whitelisted"

**Solution:**

- Check if whitelist is enabled: The test script will tell you
- If needed, run: `npx hardhat run scripts/register-token-with-helper.ts --network base`

### Issue: "Insufficient gas"

**Solution:**

- Make sure you have ETH in your wallet for gas
- Check balance: `cast balance $YOUR_ADDRESS --rpc-url $BASE_RPC_URL`
- Get ETH from an exchange or bridge

### Issue: "Transaction reverted"

**Solution:**

- Check token implements ERC20 correctly
- Verify TransferHelper address is correct
- Check token allowance: The test script shows this
- Look at transaction on BaseScan for specific error

## Understanding Gas Costs

After running tests, you'll see gas costs like:

| Operation          | Gas Used | Cost (at 0.1 gwei) |
| ------------------ | -------- | ------------------ |
| Approve            | ~46,000  | ~$0.0046           |
| Single Transfer    | ~55,000  | ~$0.0055           |
| Batch Transfer (3) | ~135,000 | ~$0.0135           |

**These costs will be $0 once you enable Coinbase Paymaster!** 🎉

## Verifying on BaseScan

After each transaction:

1. Copy the transaction hash from output
2. Go to: `https://basescan.org/tx/<TX_HASH>`
3. Verify:
   - ✅ Status: Success
   - ✅ To: TransferHelper address
   - ✅ Function: transferToken or batchTransfer
   - ✅ Events: TransferExecuted events

## What You've Verified

After completing these tests:

- ✅ **TransferHelper deploys correctly**
- ✅ **Token approvals work**
- ✅ **Single transfers execute successfully**
- ✅ **Batch transfers save gas**
- ✅ **Events are emitted correctly**
- ✅ **Token balances update properly**
- ✅ **No security issues or reverts**

## Next Steps: Add Gas Sponsorship

Now that core functionality is verified, you can add Coinbase Paymaster:

### 1. Configure Coinbase Developer Portal

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Navigate to your app → Paymaster settings
3. Add TransferHelper address to whitelist:
   ```
   Whitelisted Contract: 0x...  (your TransferHelper address)
   ```
4. Configure policies:
   - Max gas per transaction: 500,000
   - Daily limit per user: 10 transactions
   - etc.

### 2. Update Frontend

```typescript
// Configure Coinbase Smart Wallet
import { coinbaseWallet } from 'wagmi/connectors';

const config = createConfig({
  connectors: [
    coinbaseWallet({
      appName: 'Your App',
      preference: 'smartWalletOnly', // Enable Smart Wallet
    }),
  ],
});
```

### 3. Test with Smart Wallet

Now when users with Coinbase Smart Wallet call TransferHelper:

- Gas fees will be $0 (sponsored)
- Same exact flow as your script tests
- But with better UX for end users

## Monitoring & Analytics

Track your TransferHelper usage:

```typescript
// Listen to events
const filter = transferHelper.filters.TransferExecuted();
transferHelper.on(filter, (token, from, to, amount, event) => {
  console.log('Transfer executed:', {
    token,
    from,
    to,
    amount: ethers.formatEther(amount),
    txHash: event.transactionHash,
  });
});
```

## Script Reference

| Script                            | Purpose              | Command                                                                  |
| --------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `deploy-transfer-helper.ts`       | Deploy contract      | `npx hardhat run scripts/deploy-transfer-helper.ts --network base`       |
| `test-transfer-helper-mainnet.ts` | Test single transfer | `npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base` |
| `test-batch-transfer-mainnet.ts`  | Test batch transfer  | `npx hardhat run scripts/test-batch-transfer-mainnet.ts --network base`  |
| `register-token-with-helper.ts`   | Whitelist token      | `npx hardhat run scripts/register-token-with-helper.ts --network base`   |

## Quick Start Commands

```bash
# 1. Deploy TransferHelper
npx hardhat run scripts/deploy-transfer-helper.ts --network base
# Save the deployed address!

# 2. Edit scripts/test-transfer-helper-mainnet.ts
# Update the config object with your addresses:
#   - transferHelperAddress (from step 1)
#   - testTokenAddress (your token)
#   - recipientAddress (where to send test)

# 3. Test single transfer
npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base

# 4. Edit scripts/test-batch-transfer-mainnet.ts
# Update the config object with:
#   - transferHelperAddress
#   - testTokenAddress
#   - recipients array
#   - amounts array

# 5. Test batch transfer
npx hardhat run scripts/test-batch-transfer-mainnet.ts --network base

# 6. Verify contract (optional)
npx hardhat verify --network base <TRANSFER_HELPER_ADDRESS>

# 7. Ready for Coinbase Paymaster integration! 🎉
```

## Summary

You've now:

1. ✅ Deployed TransferHelper to mainnet
2. ✅ Verified it works with real tokens
3. ✅ Tested single and batch transfers
4. ✅ Measured actual gas costs
5. ✅ Confirmed everything works before adding Coinbase

**Next:** Set up Coinbase Paymaster to make all these transfers gas-free for your users! 🚀

## Support

If you run into issues:

- Check BaseScan for transaction details
- Review test script output for errors
- Verify all addresses in `.env` are correct
- Make sure you have sufficient ETH and tokens
- Check the troubleshooting section above
