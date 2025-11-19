# Upgrade Changes - Added Proxy Upgrade to Setup Script

## Summary

Updated the `setup-regular-space-token-integration.ts` script to include deployment of a new implementation and upgrading the UUPS proxy at `0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a`.

## Changes Made

### 1. Updated setup-regular-space-token-integration.ts

**Added Functions:**

1. **`deployNewImplementation(wallet)`**

   - Reads compiled contract artifact from `artifacts/contracts/energytokenupdatable.sol/RegularSpaceToken.json`
   - Deploys the new implementation contract
   - Returns the new implementation address
   - **Requires contract to be compiled first with `npx hardhat compile`**

2. **`upgradeProxy(proxyAddress, newImplementationAddress, wallet)`**
   - Verifies you are the proxy owner
   - Calls `upgradeTo(newImplementation)` on the proxy
   - Verifies the upgrade was successful
   - Uses UUPS upgrade pattern

**Updated Step Numbers:**

- Step 1: Deploy New Implementation (**NEW**)
- Step 2: Upgrade Proxy (**NEW**)
- Step 3: Check Token Information (was Step 1)
- Step 4: Authorize EnergyDistribution (was Step 2)
- Step 5: Update EnergyDistribution (was Step 3)
- Step 6: Run Emergency Reset (was Step 4)
- Step 7: Verify Complete Setup (was Step 5)

**Updated Main Function:**

```typescript
// Step 1: Deploy new implementation
const newImplementationAddress = await deployNewImplementation(wallet);

// Step 2: Upgrade proxy to new implementation
await upgradeProxy(REGULAR_SPACE_TOKEN_PROXY_ADDRESS, newImplementationAddress, wallet);

// ... rest of the steps
```

**Updated Constants:**

- Renamed `NEW_REGULAR_SPACE_TOKEN_ADDRESS` to `REGULAR_SPACE_TOKEN_PROXY_ADDRESS`
- Added clear indication that address is a proxy

**Added ABI Methods:**

- `upgradeTo(address newImplementation)` - UUPS upgrade function
- `implementation()` - Get current implementation (optional check)

### 2. Updated README-REGULAR-SPACE-TOKEN-SETUP.md

**Changes:**

- Updated title to include "with Proxy Upgrade"
- Added Step 1 & 2 for deployment and upgrade
- Updated all step numbers
- Added note about compiling contract first
- Updated expected output to include new steps
- Changed contract reference from `RegularSpaceTokenNew.sol` to `energytokenupdatable.sol`

**New Prerequisites:**

- Must compile contract first: `npx hardhat compile`
- Script depends on compiled artifacts

### 3. Updated QUICK-START.md

**Changes:**

- Updated title to include "with Proxy Upgrade"
- Added `npx hardhat compile` as first step in TL;DR
- Updated "What Changed" section to reference `energytokenupdatable.sol`
- Mentioned UUPS upgradeable proxy pattern
- Updated expected output

### 4. Updated verify-regular-space-token-setup.ts

**No changes needed** - verification script works with the upgraded proxy

## Contract Being Used

The script now uses `energytokenupdatable.sol` which is a UUPS upgradeable version with:

- `Initializable` - for proxy initialization
- `ERC20Upgradeable` - upgradeable ERC20
- `ERC20BurnableUpgradeable` - upgradeable burnable
- `OwnableUpgradeable` - upgradeable ownership
- `UUPSUpgradeable` - upgradeable proxy support

**Key Features:**

- `authorized` mapping for authorized contracts
- `setAuthorized()` function for owner to grant/revoke authorization
- `burn()` and `burnFrom()` functions for authorized contracts
- `decimals()` returns 6 (USDC-compatible)
- `mint()` function for owner and authorized contracts
- Auto-mint to treasury on transfer for authorized contracts
- `_authorizeUpgrade()` for UUPS upgrade authorization

## Usage

### Prerequisites

1. **Compile the contract:**

   ```bash
   cd packages/storage-evm
   npx hardhat compile
   ```

2. **Set up environment:**
   - Have `PRIVATE_KEY` in `.env` or `accounts.json`
   - Have sufficient ETH for gas fees
   - Be the owner of the proxy
   - Be whitelisted on EnergyDistribution

### Run Setup

```bash
cd packages/storage-evm
npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts
```

### What Happens

1. ✅ Deploys new implementation contract
2. ✅ Upgrades proxy to point to new implementation
3. ✅ Checks token information
4. ✅ Authorizes EnergyDistribution
5. ✅ Updates EnergyDistribution to use token
6. ✅ Runs emergency reset
7. ✅ Verifies complete setup

### Success Output

```
🎉 SUCCESS! All steps completed!
✅ New Implementation: 0x...
✅ Proxy upgraded: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
✅ EnergyDistribution updated
✅ Authorization configured
✅ Emergency reset completed
```

## Important Notes

1. **Must compile first**: The script reads the compiled artifact, so you must run `npx hardhat compile` before running the script

2. **Proxy address unchanged**: The proxy address `0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a` remains the same, only the implementation it points to changes

3. **Owner required**: You must be the owner of the proxy to upgrade it

4. **UUPS pattern**: Uses UUPS (Universal Upgradeable Proxy Standard) where the upgrade logic is in the implementation contract, not a separate proxy admin

5. **Gas costs**: Deploying a new implementation contract will cost gas (implementation deployment + upgrade transaction)

## Troubleshooting

### "Contract not compiled"

**Solution:** Run `npx hardhat compile` first

### "You are not the proxy owner"

**Solution:** Use the wallet that owns the proxy

### "Upgrade transaction failed"

**Solution:** Check that the new implementation is compatible with the existing proxy storage layout

## Files Modified

1. `/packages/storage-evm/scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts` - Added deployment and upgrade logic
2. `/packages/storage-evm/scripts/base-mainnet-contracts-scripts/README-REGULAR-SPACE-TOKEN-SETUP.md` - Updated documentation
3. `/packages/storage-evm/scripts/base-mainnet-contracts-scripts/QUICK-START.md` - Updated quick start guide

## Files Created

1. `/packages/storage-evm/scripts/base-mainnet-contracts-scripts/UPGRADE-CHANGES.md` - This file

## Testing Checklist

Before running on mainnet:

- [ ] Compiled contract successfully
- [ ] Have private key with proxy ownership
- [ ] Have sufficient ETH for gas
- [ ] Whitelisted on EnergyDistribution
- [ ] Tested on testnet (optional but recommended)
- [ ] Verified implementation contract is correct
- [ ] Understand that upgrade is irreversible (unless upgraded again)

## Rollback

If you need to rollback:

1. Deploy the old implementation contract
2. Call `upgradeTo(oldImplementationAddress)` on the proxy
3. This requires being the proxy owner

Or simply deploy a new corrected implementation and upgrade to that.

---

**Status:** ✅ Script updated and ready to use
**Version:** 2.0 (with proxy upgrade support)
**Date:** November 2025
