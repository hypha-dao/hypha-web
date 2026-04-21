# Quick Token Upgrade Guide

A simplified guide for quickly upgrading token contracts. For full documentation, see [TOKEN_UPGRADE_SYSTEM.md](./TOKEN_UPGRADE_SYSTEM.md).

## Prerequisites

- Node.js and npm/pnpm installed
- `.env` file configured with `RPC_URL` and `PRIVATE_KEY`
- Access to admin wallet (`0x2687fe290b54d824c136Ceff2d5bD362Bc62019a`)

## Quick Start (5 Steps)

### 1. Get All Upgradable Token Addresses

```bash
cd packages/storage-evm
npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts
```

This creates files in `token-upgrade-data/`:

- `regular-addresses-{timestamp}.txt`
- `ownership-addresses-{timestamp}.txt`
- `decaying-addresses-{timestamp}.txt`

### 2. Check Current Implementations (Optional)

```bash
# For Regular tokens
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file scripts/base-mainnet-contracts-scripts/token-upgrade-data/regular-addresses-{timestamp}.txt

# For Ownership tokens
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file scripts/base-mainnet-contracts-scripts/token-upgrade-data/ownership-addresses-{timestamp}.txt

# For Decaying tokens
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file scripts/base-mainnet-contracts-scripts/token-upgrade-data/decaying-addresses-{timestamp}.txt
```

### 3. Edit Upgrade Script

Open `scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts` and configure:

```typescript
// Choose token type
const TOKEN_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';

// Load addresses from the file created in Step 1
const LOAD_FROM_FILE = true;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-2024-11-11T10-30-00.txt';

// Start with dry run
const DRY_RUN = true;
```

### 4. Test with Dry Run

```bash
npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

Review the output. If everything looks good, proceed to step 5.

### 5. Perform Real Upgrade

Edit the script again:

```typescript
const DRY_RUN = false; // Change to false
```

Then run:

```bash
npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

⚠️ **You have 5 seconds to cancel with Ctrl+C after starting!**

## Verify Upgrades

After upgrading, verify the changes:

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file scripts/base-mainnet-contracts-scripts/token-upgrade-data/regular-addresses-{timestamp}.txt
```

All tokens should now show the new implementation address.

## Current Implementation Addresses

### Regular Tokens

- **Current**: `0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0`

### Ownership Tokens

- **Current**: `0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39`

### Decaying Tokens

- **Current**: `0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B`

## Factory Addresses

```
Regular Token Factory:    0x95A33EC94de2189893884DaD63eAa19f7390144a
Ownership Token Factory:   0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6
Decaying Token Factory:    0x299f4D2327933c1f363301dbd2a28379ccD5539b
```

## Common Commands Cheatsheet

```bash
# Discover all upgradable tokens
npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts

# Check implementations of specific tokens
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts 0xABC... 0xDEF...

# Check implementations from file
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts --file path/to/addresses.txt

# Upgrade tokens (after editing the script)
npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

## Troubleshooting

### Script not found?

Make sure you're in the `packages/storage-evm` directory:

```bash
cd packages/storage-evm
```

### Missing dependencies?

Install them:

```bash
pnpm install
```

### RPC errors?

Check your `.env` file has valid `RPC_URL` and `PRIVATE_KEY`.

### Need help?

See the full documentation: [TOKEN_UPGRADE_SYSTEM.md](./TOKEN_UPGRADE_SYSTEM.md)

## Output Files Location

All scripts save output to:

```
scripts/base-mainnet-contracts-scripts/token-upgrade-data/
```

Files are timestamped for audit purposes.

## Safety Tips

1. ✅ **Always do a dry run first** (`DRY_RUN = true`)
2. ✅ **Test on a small subset** before upgrading all tokens
3. ✅ **Check implementations before and after** upgrading
4. ✅ **Keep the output files** for audit purposes
5. ✅ **Verify on a testnet first** if possible

## Next Steps

After upgrading tokens, you may want to:

- Deploy new token implementation to factories
- Update factory implementation addresses
- Test new token features
- Document changes made

For complete documentation and advanced usage, see [TOKEN_UPGRADE_SYSTEM.md](./TOKEN_UPGRADE_SYSTEM.md).
