# Fix Energy Token - Complete Guide

## Problem Summary

The EnergyToken at `0xd8724e6609838a54F7e505679BF6818f1A3F2D40` was mistakenly upgraded to `RegularSpaceToken` implementation, causing **storage corruption**. The `authorized` mapping is broken, preventing the emergency reset from working.

## Root Cause

- **RegularSpaceToken**: Has `spaceId`, `maxSupply`, `transferable` fields BEFORE the `authorized` mapping
- **EnergyToken**: Starts directly with the `authorized` mapping
- Upgrading between them caused storage slot misalignment → broken authorization

## Solution

Deploy a **NEW** EnergyToken contract and configure the system to use it. This is safer than trying to fix the corrupted proxy.

---

## Option 1: Automated Fix (Recommended)

Run the complete automated script that does everything:

```bash
cd /Users/vlad/hypha-web/packages/storage-evm/scripts/base-mainnet-contracts-scripts
ts-node fix-energy-token-complete.ts
```

This will:

1. ✅ Deploy new EnergyToken contract
2. ✅ Update EnergyDistribution to use new token
3. ✅ Authorize EnergyDistribution to burn tokens
4. ✅ Verify everything is working

Then run emergency reset:

```bash
ts-node emergency-reset.ts execute
```

---

## Option 2: Manual Steps

If you prefer to do it step-by-step:

### Step 1: Deploy New EnergyToken

```bash
cd /Users/vlad/hypha-web/packages/storage-evm
npx hardhat run scripts/energy-token.deploy.ts --network base-mainnet
```

**Note the deployed token address from the output!**

### Step 2: Update EnergyDistribution

```bash
cd scripts/base-mainnet-contracts-scripts
ts-node set-energy-token.ts <NEW_TOKEN_ADDRESS> 0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95
```

### Step 3: Authorize EnergyDistribution

```bash
ts-node set-authorized-energy-token.ts 0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95 true
```

### Step 4: Run Emergency Reset

```bash
ts-node emergency-reset.ts execute
```

---

## Verification

After completion, verify the setup:

```bash
# Check that EnergyDistribution is using the new token
ts-node check-energy-setup.ts

# Check whitelist and authorization status
ts-node emergency-reset.ts whitelist
```

---

## What Happens to the Old Token?

The old token at `0xd8724e6609838a54F7e505679BF6818f1A3F2D40` will be:

- ✅ Orphaned (no longer used by EnergyDistribution)
- ✅ Safe to ignore (can't be used anymore)
- ✅ Won't affect the system

---

## Key Addresses

- **Old (Corrupted) Token**: `0xd8724e6609838a54F7e505679BF6818f1A3F2D40`
- **EnergyDistribution**: `0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95`
- **New Token**: Will be shown after deployment

---

## Troubleshooting

### "Not whitelisted" error

- Make sure your wallet is whitelisted in EnergyDistribution
- The automated script checks this

### "Not the owner" error

- Make sure you're using the correct wallet that owns the contracts
- Check with: `ts-node emergency-reset.ts whitelist`

### Deployment fails

- Check you have enough ETH for gas
- Verify RPC_URL and PRIVATE_KEY in .env

---

## Why This Approach?

✅ **Safe**: No risk of further corrupting storage  
✅ **Clean**: Fresh start with correct contract  
✅ **Simple**: Clear separation of concerns  
❌ Trying to fix the proxy: High risk of more corruption
