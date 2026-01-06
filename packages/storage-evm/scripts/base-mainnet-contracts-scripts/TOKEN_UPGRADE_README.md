# Token Upgrade System - Summary

## What Was Created

A comprehensive system for managing upgradable token contracts across three token factories on Base Mainnet.

### Scripts Created

1. **`get-all-upgradable-tokens.ts`**

   - Discovers all upgradable tokens from all three factories
   - Outputs JSON, CSV, and TXT files with token addresses
   - Identifies which tokens are upgradable vs non-upgradable

2. **`upgrade-multiple-tokens.ts`**

   - Upgrades multiple token contracts with new implementations
   - Supports dry-run mode for testing
   - Handles common errors automatically
   - Saves detailed results for audit purposes

3. **`check-token-implementations.ts`**

   - Checks current implementation addresses of tokens
   - Identifies which version each token is using
   - Can process individual addresses or files

4. **`update-factory-implementations.ts`**
   - Updates the token implementation address in factories
   - Ensures new tokens use the latest implementation
   - Includes safety checks and confirmation prompts

### Documentation Created

1. **`TOKEN_UPGRADE_SYSTEM.md`** - Complete reference documentation
2. **`QUICK_UPGRADE_GUIDE.md`** - Quick start guide
3. **`TOKEN_UPGRADE_README.md`** - This file (summary)

## The Three Token Types

Your system has three types of upgradable tokens:

### Regular Tokens (RegularSpaceToken)

- **Factory**: `0x95A33EC94de2189893884DaD63eAa19f7390144a`
- **Current Implementation**: `0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0`
- Standard ERC20 tokens with configurable transferability

### Ownership Tokens (OwnershipSpaceToken)

- **Factory**: `0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6`
- **Current Implementation**: `0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39`
- Tokens that can only be transferred between space members

### Decaying Tokens (DecayingSpaceToken)

- **Factory**: `0x299f4D2327933c1f363301dbd2a28379ccD5539b`
- **Current Implementation**: `0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B`
- Tokens with configurable vote decay over time

## How It Works

### Token Deployment

Each factory deploys tokens as **ERC1967 upgradable proxies**:

- The proxy contract has a fixed address (never changes)
- The implementation contract can be upgraded
- Users interact with the proxy, which delegates to the implementation

### Discovery Process

The `get-all-upgradable-tokens.ts` script:

1. Queries the DAOSpaceFactory for total space count
2. For each space, queries all three factories for deployed tokens
3. Checks if each token is upgradable (has ERC1967 implementation slot)
4. Retrieves current implementation addresses
5. Saves results to files for later use

### Upgrade Process

The `upgrade-multiple-tokens.ts` script:

1. Loads token addresses (from file or array)
2. Compiles the new implementation contract
3. For each token:
   - Gets current implementation address
   - Deploys new implementation
   - Updates the proxy to point to new implementation
   - Verifies the upgrade succeeded
4. Saves detailed results

## Quick Usage Examples

### 1. Discover All Upgradable Tokens

```bash
cd packages/storage-evm
npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts
```

Output files created in `token-upgrade-data/`:

- `regular-addresses-{timestamp}.txt`
- `ownership-addresses-{timestamp}.txt`
- `decaying-addresses-{timestamp}.txt`

### 2. Check Token Implementations

```bash
# Check specific tokens
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  0x123... 0x456... 0x789...

# Check from file
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file token-upgrade-data/regular-addresses-{timestamp}.txt
```

### 3. Upgrade Tokens

Edit `upgrade-multiple-tokens.ts`:

```typescript
const TOKEN_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';
const LOAD_FROM_FILE = true;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-{timestamp}.txt';
const DRY_RUN = false;
```

Run:

```bash
npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

### 4. Update Factory Implementation

After deploying a new token implementation, update the factory:

Edit `update-factory-implementations.ts`:

```typescript
const FACTORY_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';
const NEW_IMPLEMENTATION_ADDRESS = '0xYourNewImplementationAddress';
const DRY_RUN = false;
```

Run:

```bash
npx hardhat run scripts/base-mainnet-contracts-scripts/update-factory-implementations.ts --network base-mainnet
```

## Complete Workflow

### Scenario: Upgrade All Regular Tokens

1. **Discover tokens**:

   ```bash
   npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts
   ```

2. **Check current implementations** (optional):

   ```bash
   npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
     --file token-upgrade-data/regular-addresses-{timestamp}.txt
   ```

3. **Test upgrade** (dry run):

   - Edit `upgrade-multiple-tokens.ts`: Set `DRY_RUN = true`
   - Run upgrade script
   - Review output

4. **Perform upgrade**:

   - Edit `upgrade-multiple-tokens.ts`: Set `DRY_RUN = false`
   - Run upgrade script
   - Wait for completion

5. **Verify upgrades**:

   ```bash
   npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
     --file token-upgrade-data/regular-addresses-{timestamp}.txt
   ```

6. **Update factory** (for new deployments):
   - Deploy new token implementation (if not already done)
   - Run `update-factory-implementations.ts`

## File Structure

```
scripts/base-mainnet-contracts-scripts/
├── get-all-upgradable-tokens.ts      # Discover tokens
├── upgrade-multiple-tokens.ts         # Upgrade tokens
├── check-token-implementations.ts     # Check implementations
├── update-factory-implementations.ts  # Update factories
├── TOKEN_UPGRADE_SYSTEM.md           # Full documentation
├── QUICK_UPGRADE_GUIDE.md            # Quick reference
├── TOKEN_UPGRADE_README.md           # This file
└── token-upgrade-data/               # Output directory
    ├── upgradable-tokens-{timestamp}.json
    ├── regular-addresses-{timestamp}.txt
    ├── ownership-addresses-{timestamp}.txt
    ├── decaying-addresses-{timestamp}.txt
    └── upgrade-results-{type}-{timestamp}.json
```

## Key Features

### Safety Features

- ✅ Dry run mode for testing
- ✅ 5-second confirmation before real operations
- ✅ Automatic proxy import for unregistered contracts
- ✅ Verification of upgrade success
- ✅ Detailed logging and error reporting
- ✅ Timestamped output files for audit trail

### Flexibility

- ✅ Load addresses from files or arrays
- ✅ Process all tokens or specific subsets
- ✅ Multiple output formats (JSON, CSV, TXT)
- ✅ Command-line arguments support
- ✅ Configurable delays between operations

### Error Handling

- ✅ Handles unregistered proxies automatically
- ✅ Continues on individual failures
- ✅ Reports all errors in summary
- ✅ Saves results even on partial failures

## Important Notes

### Not All Tokens Are Upgradable

Some early tokens may not be upgradable if they were deployed before the proxy pattern was implemented. The discovery script identifies these automatically.

### Two Types of Updates

1. **Upgrade Existing Tokens**: Use `upgrade-multiple-tokens.ts`

   - Updates already deployed tokens
   - Each token must be upgraded individually
   - Requires owner permissions

2. **Update Factory**: Use `update-factory-implementations.ts`
   - Only affects NEW tokens deployed after the update
   - Does NOT upgrade existing tokens
   - Changes where the factory points for new deployments

### Permissions

All operations require the admin wallet:

- **Address**: `0x2687fe290b54d824c136Ceff2d5bD362Bc62019a`
- Make sure your `.env` has the correct private key

### Gas Costs

- Upgrading tokens costs gas
- The scripts include delays to prevent rate limiting
- Estimate costs before upgrading many tokens

## Troubleshooting

### "Proxy not registered" error

**Solution**: The script handles this automatically with `upgrades.forceImport()`

### "Implementation did not change" warning

**Cause**: New bytecode is identical to old, or transaction failed
**Solution**: Check implementation addresses manually

### RPC rate limiting

**Solution**: Increase `WAIT_TIME_BETWEEN_UPGRADES` in upgrade script

### Permission denied

**Solution**: Ensure you're using the admin wallet's private key

## Next Steps

1. **Read the documentation**:

   - Start with `QUICK_UPGRADE_GUIDE.md` for quick reference
   - See `TOKEN_UPGRADE_SYSTEM.md` for complete details

2. **Test the system**:

   - Run discovery script to see current state
   - Use dry run mode to test upgrades
   - Check a few tokens manually

3. **Perform upgrades** (when ready):
   - Start with a small test batch
   - Verify results before continuing
   - Keep output files for records

## Support

For questions or issues:

1. Check the documentation files
2. Review script source code for details
3. Check output files in `token-upgrade-data/`
4. Contact the development team

## Version History

### 2024-11-11 - Initial Release

- Created complete token upgrade system
- Four scripts for token management
- Comprehensive documentation
- Safety features and error handling
