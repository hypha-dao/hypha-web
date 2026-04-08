# Quick Start Guide - RegularSpaceToken Integration with Proxy Upgrade

## TL;DR

Run these commands to upgrade and integrate the RegularSpaceToken proxy with EnergyDistribution:

```bash
# Navigate to storage-evm package
cd packages/storage-evm

# Compile the contract first (IMPORTANT!)
npx hardhat compile

# Run the setup (this will deploy, upgrade, and configure)
npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts

# Verify everything worked (read-only checks)
npx ts-node scripts/base-mainnet-contracts-scripts/verify-regular-space-token-setup.ts
```

## What You Need

1. **Private Key**: In `.env` file or `accounts.json`
2. **ETH Balance**: On Base mainnet for gas fees
3. **Token Owner**: You must own the RegularSpaceToken (`0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a`)
4. **Whitelist**: You must be whitelisted on EnergyDistribution

## Environment Setup

### Option 1: Using .env file

Create `.env` in `packages/storage-evm/`:

```env
RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

### Option 2: Using accounts.json

Create `accounts.json` in the scripts directory:

```json
[
  {
    "privateKey": "your_private_key_without_0x_prefix",
    "address": "0xYourAddress"
  }
]
```

## Step-by-Step

### 1. Run Setup Script

This script will:

- Deploy new implementation contract
- Upgrade proxy to new implementation
- Check token ownership
- Authorize EnergyDistribution
- Update EnergyDistribution to use the token
- Reset all balances
- Verify everything

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts
```

**Expected output:**

```
🎉 SUCCESS! All steps completed!
✅ New Implementation: 0x...NewImplementationAddress...
✅ Proxy upgraded: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
✅ EnergyDistribution updated
✅ Authorization configured
✅ Emergency reset completed
```

### 2. Verify Setup (Optional but Recommended)

Run read-only checks to confirm everything is working:

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/verify-regular-space-token-setup.ts
```

**Expected output:**

```
🎉 All verification checks passed!
The system is properly configured and ready to use.
```

## What Changed

### Contract Changes

**energytokenupdatable.sol (New Implementation):**

- UUPS upgradeable proxy pattern
- Added authorization system (like EnergyToken)
- Added burn functions for authorized contracts
- Added auto-mint on transfer to treasury for authorized contracts
- Set decimals to 6 (USDC compatible)
- Upgradeable via `upgradeTo()` function

**EnergyDistributionImplementation.sol:**

- Updated hardcoded token address to new RegularSpaceToken proxy

## Addresses

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| RegularSpaceToken (New) | `0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a` |
| EnergyDistribution      | `0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95` |
| Old Token               | `0xd8724e6609838a54F7e505679BF6818f1A3F2D40` |

## Common Issues

### "You must be the token owner to proceed"

👉 Make sure you're using the account that deployed the token

### "Wallet is not whitelisted on EnergyDistribution"

👉 Contact the EnergyDistribution owner to whitelist your address

### "Insufficient funds for gas"

👉 Add more ETH to your wallet on Base mainnet

### Script hangs or times out

👉 Check your RPC_URL is correct and accessible

## After Setup

Once setup is complete:

1. ✅ System is reset to zero-sum state
2. ✅ All member balances are cleared
3. ✅ New token is integrated
4. ✅ Ready for new energy distributions

## Need More Help?

- **Full Documentation**: `README-REGULAR-SPACE-TOKEN-SETUP.md`
- **Technical Details**: `INTEGRATION-SUMMARY.md`
- **Check Transactions**: https://basescan.org

## Verify Specific Things

### Check if token is authorized:

```typescript
// Using ethers.js
const token = new ethers.Contract(tokenAddress, abi, provider);
const isAuthorized = await token.authorized(energyDistributionAddress);
console.log(isAuthorized); // Should be true
```

### Check current token in EnergyDistribution:

```typescript
const energyDist = new ethers.Contract(energyDistAddress, abi, provider);
const currentToken = await energyDist.getEnergyTokenAddress();
console.log(currentToken); // Should be 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
```

### Check zero-sum property:

```typescript
const [isZeroSum, balance] = await energyDist.verifyZeroSumProperty();
console.log(isZeroSum); // Should be true
console.log(balance.toString()); // Should be "0"
```

## Next Steps After Integration

1. Test energy distribution with the new token
2. Monitor system balance to ensure zero-sum is maintained
3. Verify token operations work correctly
4. Document any issues or unexpected behavior

## Emergency Procedures

If something goes wrong:

1. **Run verification script** to diagnose:

   ```bash
   npx ts-node scripts/base-mainnet-contracts-scripts/verify-regular-space-token-setup.ts
   ```

2. **Re-run setup script** if needed:

   ```bash
   npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts
   ```

3. **Check transactions** on BaseScan for details

4. **Contact support** with transaction hashes and error messages

---

**Ready to start?** Run the setup script! 🚀
