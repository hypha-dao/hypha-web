# TransferHelper - Quick Start Guide

## 🚀 3-Step Setup (5 minutes)

### Step 1: Deploy TransferHelper

```bash
npx hardhat run scripts/deploy-transfer-helper.ts --network base
```

**Output:**

```
✅ TransferHelper deployed successfully!
TransferHelper address: 0x1234567890abcdef...
```

**→ Copy this address!** You'll need it for the next steps.

---

### Step 2: Configure Test Script

Open `scripts/test-transfer-helper-mainnet.ts` in your editor.

Find this section at the top:

```typescript
// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: TestConfig = {
  transferHelperAddress: '0x...', // ← Paste address from Step 1
  testTokenAddress: '0x...', // ← Your token address
  recipientAddress: '0x...', // ← Where to send test transfer
  transferAmount: '1',
};
// ============================================================================
```

**Replace the `0x...` values with:**

- `transferHelperAddress`: The address from Step 1
- `testTokenAddress`: Any ERC20 token you own
- `recipientAddress`: Any address you control (can be another wallet)
- `transferAmount`: How many tokens to transfer (e.g., '1', '10', '100')

**Save the file.**

---

### Step 3: Run Test

```bash
npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base
```

**Expected output:**

```
🧪 Testing TransferHelper on Mainnet
═══════════════════════════════════════════════════════

✅ Approved! Block: 12345678
✅ Transfer successful! Block: 12345679

🎉 TEST COMPLETED SUCCESSFULLY!

✅ TransferHelper is working correctly
✅ Tokens were transferred successfully
✅ Ready to integrate with Coinbase Paymaster
```

---

## ✅ Success!

If you see the output above, TransferHelper is working!

## 🎯 Next Steps

### Test Batch Transfers (Optional)

1. Open `scripts/test-batch-transfer-mainnet.ts`
2. Update the config at the top:

```typescript
const config: BatchTestConfig = {
  transferHelperAddress: '0x1234...', // Same as before
  testTokenAddress: '0x5678...', // Same token
  recipients: [
    '0xaaaa...', // Recipient 1
    '0xbbbb...', // Recipient 2
    '0xcccc...', // Recipient 3
  ],
  amounts: ['1', '2', '3'], // Send different amounts to each
};
```

3. Run: `npx hardhat run scripts/test-batch-transfer-mainnet.ts --network base`

### Enable Gas Sponsorship (Coinbase Paymaster)

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Navigate to Paymaster settings
3. Add your TransferHelper address: `0x1234...` (from Step 1)
4. Configure gas policies
5. Done! All transfers through TransferHelper are now gas-free for Smart Wallet users! 🎉

---

## 📝 Common Issues

### "Insufficient token balance"

**Fix:** Make sure your wallet owns tokens at `testTokenAddress`

### "Token not whitelisted"

**Fix:** The script will tell you if this is needed. If so:

1. Open `scripts/register-token-with-helper.ts`
2. Update config with your addresses
3. Run: `npx hardhat run scripts/register-token-with-helper.ts --network base`

### "Invalid address"

**Fix:** Make sure all addresses in the config start with `0x` and are 42 characters long

---

## 🎓 Full Documentation

- **This guide**: Quick 3-step setup
- **Full testing guide**: [MAINNET_TESTING_GUIDE.md](./MAINNET_TESTING_GUIDE.md)
- **Integration guide**: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- **Contract docs**: [../contracts/TransferHelper.docs.md](../contracts/TransferHelper.docs.md)

---

## 📋 Checklist

- [ ] Deploy TransferHelper ✓
- [ ] Save the deployed address ✓
- [ ] Update test script config ✓
- [ ] Run single transfer test ✓
- [ ] (Optional) Run batch transfer test
- [ ] (Optional) Whitelist with Coinbase Paymaster
- [ ] Integrate into your frontend

---

## 💡 Pro Tips

**Tip 1:** Use the same `transferHelperAddress` for all tests - you only deploy it once!

**Tip 2:** You can test with any ERC20 token you own. Don't need to deploy new tokens just for testing.

**Tip 3:** For `recipientAddress`, you can use another wallet you control - that way you can verify the tokens arrived.

**Tip 4:** Start with a small `transferAmount` like '1' or '0.1' for your first test.

**Tip 5:** Check transactions on [BaseScan](https://basescan.org) to see the exact gas costs and events.

---

**Questions?** Check the [Full Testing Guide](./MAINNET_TESTING_GUIDE.md) for detailed troubleshooting.
