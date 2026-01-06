# Breaking Changes and Migration Guide

## RegularSpaceToken Upgrade: Auto-Minting Behavior Change

### Overview

When upgrading from the old `RegularSpaceToken` to the new version with advanced configuration options, there is a **critical breaking change** regarding auto-minting behavior.

### The Breaking Change

**Old Contract Behavior:**

- Executor ALWAYS auto-mints when transferring if balance is insufficient
- This behavior was hardcoded in the `transfer()` and `transferFrom()` functions

**New Contract Behavior:**

- Executor only auto-mints if the `autoMinting` boolean flag is `true`
- New storage variable: `bool public autoMinting`
- Default value after upgrade: `false` ❌

### Impact

After upgrading existing tokens:

- ✅ Executor can still call `mint()` directly
- ❌ Executor will NOT auto-mint during transfers (until configured)
- ❌ Transfers from executor that relied on auto-minting will fail if balance is insufficient

### Solution: Automatic Configuration

We've implemented **Option 3** - automatic post-upgrade configuration:

1. **Contract Modification**: The `setAutoMinting()` function now allows both executor AND owner to call it
2. **Upgrade Script Enhancement**: The `upgrade-multiple-tokens.ts` script automatically sets `autoMinting=true` after each successful upgrade
3. **Standalone Script**: A dedicated `configure-token-autominting.ts` script for manual configuration if needed

## What Was Changed

### 1. RegularSpaceToken.sol

Modified `setAutoMinting()` to allow owner access:

```solidity
function setAutoMinting(bool _autoMinting) external virtual {
  require(
    msg.sender == executor || msg.sender == owner(),
    'Only executor or owner can update auto-minting'
  );
  autoMinting = _autoMinting;
  emit AutoMintingUpdated(_autoMinting);
}
```

**Why:** The contract owner (`0x2687fe290b54d824c136Ceff2d5bD362Bc62019a`) needs to be able to configure tokens immediately after upgrade, before transferring ownership or access to executors.

### 2. upgrade-multiple-tokens.ts

Enhanced the upgrade process to include automatic configuration:

```typescript
// After successful upgrade:
console.log('  🔧 Configuring post-upgrade settings...');
const tokenContract = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
const currentAutoMinting = await tokenContract.autoMinting();

if (!currentAutoMinting) {
  const configTx = await tokenContract.setAutoMinting(true);
  await configTx.wait();
  console.log('  ✅ AutoMinting enabled (backward compatibility)');
}
```

**Features:**

- Checks current `autoMinting` status before attempting to change it
- Only sets it if currently `false`
- Handles errors gracefully (upgrade still succeeds even if config fails)
- Shows clear logging at each step

### 3. New Script: configure-token-autominting.ts

A standalone script for manually configuring tokens:

```bash
# Configure specific tokens
npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts \
  --network base-mainnet -- 0x123... 0x456...

# Configure from a file
# Edit LOAD_FROM_FILE=true and ADDRESS_FILE_PATH in the script
npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts \
  --network base-mainnet

# Dry run to check status
# Edit DRY_RUN=true in the script
npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts \
  --network base-mainnet
```

## Migration Workflow

### Scenario 1: Normal Upgrade (Recommended)

The upgrade script handles everything automatically:

1. Run the upgrade script as usual:

   ```bash
   npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts \
     --network base-mainnet
   ```

2. The script will:

   - ✅ Upgrade the token implementation
   - ✅ Check `autoMinting` status
   - ✅ Set `autoMinting=true` automatically
   - ✅ Verify the configuration

3. Done! No additional steps needed.

### Scenario 2: Manual Configuration Needed

If tokens were upgraded before this fix, or if automatic configuration failed:

1. Check which tokens need configuration:

   ```bash
   # Edit the script to set DRY_RUN=true
   npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts \
     --network base-mainnet
   ```

2. Configure the tokens:

   ```bash
   # Edit the script to set DRY_RUN=false
   npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts \
     --network base-mainnet
   ```

3. Verify configuration:
   ```bash
   # Check that autoMinting is now true
   # The script will show "Already enabled" for correctly configured tokens
   ```

### Scenario 3: Upgrade Without Auto-Configuration

If you want to control when auto-minting is enabled:

1. Edit `upgrade-multiple-tokens.ts` and comment out the configuration section:

   ```typescript
   // Comment out lines 174-205 (the configuration section)
   ```

2. Run the upgrade as normal

3. Later, configure tokens individually using the configure script or manually via etherscan

## Verification

### Check if a Token Has Auto-Minting Enabled

Using ethers.js:

```typescript
const token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);
const autoMinting = await token.autoMinting();
console.log(`AutoMinting: ${autoMinting}`);
```

Using cast (from foundry):

```bash
cast call <TOKEN_ADDRESS> "autoMinting()(bool)" --rpc-url $RPC_URL
```

### Expected Values After Migration

For all upgraded tokens:

- `autoMinting = true` ✅ (maintains backward compatibility)
- All other new variables at default values (safe)

## Other New Storage Variables

These have default values that are safe:

| Variable               | Default | Impact                                      | Safe?  |
| ---------------------- | ------- | ------------------------------------------- | ------ |
| `fixedMaxSupply`       | `false` | Max supply remains changeable               | ✅ Yes |
| `autoMinting`          | `false` | ❌ **BREAKING** - needs to be set to `true` | ⚠️ No  |
| `priceInUSD`           | `0`     | Just means price not set                    | ✅ Yes |
| `useTransferWhitelist` | `false` | No transfer restrictions                    | ✅ Yes |
| `useReceiveWhitelist`  | `false` | No receive restrictions                     | ✅ Yes |
| `canTransfer[address]` | `false` | Empty whitelist                             | ✅ Yes |
| `canReceive[address]`  | `false` | Empty whitelist                             | ✅ Yes |

## Testing Recommendations

Before upgrading production tokens:

1. **Test on a single token first**

   - Upgrade one token
   - Verify autoMinting is enabled
   - Test executor transfers work as expected

2. **Use dry-run mode**

   - Set `DRY_RUN=true` in upgrade script
   - Review what would happen without executing

3. **Verify executor behavior**

   - After upgrade, test that executor can still transfer without pre-minting
   - Confirm insufficient balance triggers auto-minting

4. **Monitor gas costs**
   - The configuration adds one additional transaction per token
   - Factor this into your gas budget

## Rollback Plan

If issues are discovered after upgrade:

1. **AutoMinting can be toggled**

   ```typescript
   await token.setAutoMinting(false); // Disable if needed
   await token.setAutoMinting(true); // Re-enable
   ```

2. **Implementation can be rolled back**

   - Use the old implementation address
   - Run the upgrade script again with the old implementation
   - Note: New storage variables will remain but won't be used

3. **Executor can always mint manually**
   - Even with `autoMinting=false`, executor can call `mint()` directly
   - This is a safe fallback mode

## FAQ

### Q: Will this affect existing token balances?

**A:** No. This only affects future transfers by the executor. All existing balances remain unchanged.

### Q: What if configuration fails during upgrade?

**A:** The upgrade itself will still succeed. You'll see a warning message and can configure manually later using the standalone script.

### Q: Do I need to upgrade all tokens at once?

**A:** No. You can upgrade tokens in batches. Each token is independent.

### Q: Can I disable auto-minting after enabling it?

**A:** Yes. Call `setAutoMinting(false)` as executor or owner.

### Q: What about Ownership and Decaying tokens?

**A:** This breaking change only affects `RegularSpaceToken`. The other token types should be reviewed separately for their specific upgrade considerations.

## Support

If you encounter issues during migration:

1. Check the configuration script output logs
2. Verify you're using the correct owner/executor address
3. Review the `token-upgrade-data/autominting-config-results-*.json` file
4. Check token state using the verification commands above

## Changelog

### 2024-11-13

- Identified auto-minting breaking change
- Implemented automatic configuration in upgrade script
- Created standalone configuration script
- Updated documentation with migration guide
