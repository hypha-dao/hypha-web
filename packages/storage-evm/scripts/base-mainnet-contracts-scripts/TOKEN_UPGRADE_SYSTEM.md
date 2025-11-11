# Token Upgrade System

This directory contains scripts for managing upgradable token contracts deployed through the three token factories (Regular, Ownership, and Decaying).

## Overview

The token system consists of three types of upgradable tokens:

- **Regular Tokens**: Standard ERC20 tokens with configurable transferability
- **Ownership Tokens**: Tokens that can only be transferred between space members
- **Decaying Tokens**: Tokens with configurable vote decay over time

All tokens are deployed as ERC1967 upgradable proxies, allowing their implementation to be upgraded without changing the token address.

## Factory Addresses (Base Mainnet)

```
Regular Token Factory:    0x95A33EC94de2189893884DaD63eAa19f7390144a
Ownership Token Factory:   0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6
Decaying Token Factory:    0x299f4D2327933c1f363301dbd2a28379ccD5539b
DAO Space Factory:         0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9
```

## Known Implementation Addresses

### Regular Tokens

- **Old**: `0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6`
- **Before TransferHelper**: `0x8C105Debd4B222FFb2c438f7034158c6BA29aDB5`
- **Current**: `0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0`

### Ownership Tokens

- **Old**: `0xB06f27e16648F36C529839413f307a87b80d6ca1`
- **Current**: `0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39`

### Decaying Tokens

- **Old**: `0x5BE10FdAce191216236668d9cDb12772f73CB698`
- **Current**: `0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B`

## Scripts

### 1. Get All Upgradable Tokens

**Script**: `get-all-upgradable-tokens.ts`

Queries all three token factories to find all upgradable token contracts.

#### Usage

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts
```

#### What It Does

1. Connects to the Base Mainnet network
2. Queries the DAOSpaceFactory to get the total number of spaces
3. For each space, queries all three factories to get deployed tokens
4. Checks if each token is upgradable (has an ERC1967 implementation slot)
5. Retrieves the current implementation address for each upgradable token
6. Saves results to multiple files in the `token-upgrade-data/` directory

#### Output Files

The script creates a `token-upgrade-data/` directory with:

- **JSON file**: Comprehensive data including all token info
  - `upgradable-tokens-{timestamp}.json`
- **CSV files**: One per factory type
  - `regular-tokens-{timestamp}.csv`
  - `ownership-tokens-{timestamp}.csv`
  - `decaying-tokens-{timestamp}.csv`
- **Address lists**: Simple text files with addresses (one per line)
  - `regular-addresses-{timestamp}.txt`
  - `ownership-addresses-{timestamp}.txt`
  - `decaying-addresses-{timestamp}.txt`

#### Example Output

```
=== Fetching tokens from Regular Factory ===
Factory address: 0x95A33EC94de2189893884DaD63eAa19f7390144a
✅ Space 1: Upgradable token found at 0x123...
✅ Space 2: Upgradable token found at 0x456...
⚠️  Space 3: Non-upgradable token at 0x789...

Regular Factory Summary:
  Total tokens found: 45
  Upgradable tokens: 42
  Non-upgradable tokens: 3

=== OVERALL SUMMARY ===
Regular Factory: 42 upgradable tokens
Ownership Factory: 15 upgradable tokens
Decaying Factory: 8 upgradable tokens

Total upgradable tokens across all factories: 65
```

---

### 2. Upgrade Multiple Tokens

**Script**: `upgrade-multiple-tokens.ts`

Upgrades multiple token contracts with new implementations.

#### Configuration

Edit the following constants at the top of the script:

```typescript
// Token type to upgrade
const TOKEN_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';

// Token addresses to upgrade
const TOKEN_ADDRESSES: string[] = ['0x1234567890123456789012345678901234567890', '0x2345678901234567890123456789012345678901'];

// Load addresses from a file instead
const LOAD_FROM_FILE = false;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-latest.txt';

// Dry run mode (prepare but don't execute)
const DRY_RUN = false;

// Wait time between upgrades (milliseconds)
const WAIT_TIME_BETWEEN_UPGRADES = 5000;
```

#### Usage

```bash
# Make sure you're on the correct network
npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

#### Workflow

1. **Dry Run First** (Recommended)

   - Set `DRY_RUN = true`
   - Run the script to verify everything works
   - Review the output to ensure correct tokens are targeted

2. **Real Upgrade**

   - Set `DRY_RUN = false`
   - Edit `TOKEN_TYPE` and `TOKEN_ADDRESSES`
   - Run the script
   - Script will wait 5 seconds before starting (press Ctrl+C to cancel)
   - Upgrades are performed sequentially with delays between each

3. **Review Results**
   - Check console output for success/failure
   - Review the generated JSON file in `token-upgrade-data/`

#### Loading Addresses from File

Instead of hardcoding addresses, you can load them from a file:

```typescript
const LOAD_FROM_FILE = true;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-2024-11-11.txt';
```

The file should contain one address per line:

```
0x1234567890123456789012345678901234567890
0x2345678901234567890123456789012345678901
0x3456789012345678901234567890123456789012
```

#### Output

```
======================================================================
TOKEN UPGRADE SCRIPT
======================================================================

Admin address: 0x2687fe290b54d824c136Ceff2d5bD362Bc62019a
Token type: Regular
Dry run: NO

Tokens to upgrade: 3

[1/3] Upgrading token: 0x123...
  Current implementation: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
  🔄 Upgrading...
  New implementation: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0
  ✅ Successfully upgraded!

[2/3] Upgrading token: 0x456...
  Current implementation: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
  🔄 Upgrading...
  ⚠️  Proxy not registered. Importing and retrying...
  ✅ Proxy imported successfully
  New implementation: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0
  ✅ Successfully upgraded!

======================================================================
UPGRADE SUMMARY
======================================================================

Total tokens processed: 3
Successful upgrades: 2
Failed upgrades: 1
Total time: 47.32 seconds

✅ Successfully upgraded:
  1. 0x123...
     Old impl: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
     New impl: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0
  2. 0x456...
     Old impl: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
     New impl: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0

📄 Results saved to: token-upgrade-data/upgrade-results-regular-2024-11-11.json
```

#### Safety Features

- **5-second warning**: Gives you time to cancel before real upgrades
- **Dry run mode**: Test the upgrade process without executing
- **Automatic retry**: Handles unregistered proxies by importing them
- **Results logging**: All results saved to JSON files
- **Rate limiting**: Configurable delay between upgrades

---

### 3. Check Token Implementations

**Script**: `check-token-implementations.ts`

Checks the current implementation address of token contracts.

#### Usage

**Option 1: Edit the script**

```typescript
const TOKEN_ADDRESSES: string[] = ['0x1234567890123456789012345678901234567890', '0x2345678901234567890123456789012345678901'];
```

**Option 2: Command line arguments**

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts 0x123... 0x456...
```

**Option 3: Load from file**

```bash
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts --file token-upgrade-data/regular-addresses-2024-11-11.txt
```

#### Output

```
======================================================================
TOKEN IMPLEMENTATION CHECKER
======================================================================

✅ Connected to network

Checking 3 token(s)...

[1/3] Checking: 0x123...
  Implementation: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0
  ✅ Matches: Regular (current)

[2/3] Checking: 0x456...
  Implementation: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
  ✅ Matches: Regular (old)

[3/3] Checking: 0x789...
  ❌ Error: Not an upgradable proxy or no implementation found

======================================================================
SUMMARY
======================================================================

Total tokens checked: 3
Upgradable tokens: 2
Non-upgradable/errors: 1

📊 Tokens by implementation:

  0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0 (Regular (current)): 1 token(s)
    - 0x123...

  0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6 (Regular (old)): 1 token(s)
    - 0x456...

📚 Known implementation addresses:

Regular Tokens:
  Old: 0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6
  Before TransferHelper: 0x8C105Debd4B222FFb2c438f7034158c6BA29aDB5
  Current: 0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0

Ownership Tokens:
  Old: 0xB06f27e16648F36C529839413f307a87b80d6ca1
  Current: 0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39

Decaying Tokens:
  Old: 0x5BE10FdAce191216236668d9cDb12772f73CB698
  Current: 0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B
```

---

## Complete Upgrade Workflow

### Step 1: Discover All Upgradable Tokens

```bash
# Run the discovery script
npx ts-node scripts/base-mainnet-contracts-scripts/get-all-upgradable-tokens.ts

# This creates files in token-upgrade-data/ directory:
# - regular-addresses-{timestamp}.txt
# - ownership-addresses-{timestamp}.txt
# - decaying-addresses-{timestamp}.txt
```

### Step 2: Check Current Implementations (Optional)

```bash
# Check what implementations are currently deployed
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file token-upgrade-data/regular-addresses-2024-11-11.txt

# Review the output to see which tokens need upgrading
```

### Step 3: Test Upgrade (Dry Run)

```bash
# Edit upgrade-multiple-tokens.ts:
# - Set TOKEN_TYPE to the type you want to upgrade
# - Set LOAD_FROM_FILE = true
# - Set ADDRESS_FILE_PATH to your address list file
# - Set DRY_RUN = true

npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

### Step 4: Perform Real Upgrade

```bash
# Edit upgrade-multiple-tokens.ts:
# - Set DRY_RUN = false
# - Review all other settings

npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
```

### Step 5: Verify Upgrades

```bash
# Check that upgrades were successful
npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts \
  --file token-upgrade-data/regular-addresses-2024-11-11.txt

# All tokens should now show the new implementation address
```

---

## Important Notes

### Upgradability

Not all tokens are upgradable. The system determines upgradability by checking:

1. If the token was deployed by the factory (via `isTokenDeployedByFactory`)
2. If the token has an ERC1967 implementation slot

Early tokens may not be upgradable if they were deployed before the proxy pattern was implemented.

### Owner Permissions

To upgrade tokens, you must be the owner of the token contract. The default owner is typically:

```
0x2687fe290b54d824c136Ceff2d5bD362Bc62019a
```

Make sure your private key in `.env` corresponds to this address.

### Network Configuration

Ensure your `.env` file has:

```
RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

### Gas Considerations

Upgrading contracts costs gas. The script includes delays between upgrades to:

- Avoid overwhelming the RPC endpoint
- Allow time for transaction confirmation
- Prevent nonce conflicts

### Error Handling

The upgrade script handles common errors:

- **Unregistered proxy**: Automatically imports and retries
- **No implementation change**: Warns if upgrade didn't actually change the implementation
- **Network errors**: Reports and continues with remaining tokens

### Backup

Before upgrading:

1. Export all current implementation addresses
2. Test on a single token first
3. Keep the old implementation contract address for potential rollbacks

---

## Troubleshooting

### "Proxy not registered" Error

**Solution**: The script automatically handles this by calling `upgrades.forceImport()`

### "Implementation address did not change" Warning

**Causes**:

- The new implementation bytecode is identical to the old one
- The upgrade transaction failed but didn't revert

**Solution**: Check the implementation addresses manually and verify the contract source

### RPC Rate Limiting

**Symptoms**: Intermittent connection errors

**Solution**: Increase `WAIT_TIME_BETWEEN_UPGRADES` in the upgrade script

### Out of Gas

**Solution**: Make sure your wallet has enough ETH on Base Mainnet

---

## Files and Output

All scripts save their output to `token-upgrade-data/` directory:

```
token-upgrade-data/
├── upgradable-tokens-2024-11-11T10-30-00.json
├── regular-tokens-2024-11-11T10-30-00.csv
├── regular-addresses-2024-11-11T10-30-00.txt
├── ownership-tokens-2024-11-11T10-30-00.csv
├── ownership-addresses-2024-11-11T10-30-00.txt
├── decaying-tokens-2024-11-11T10-30-00.csv
├── decaying-addresses-2024-11-11T10-30-00.txt
├── upgrade-results-regular-2024-11-11T11-00-00.json
└── implementation-check-2024-11-11T11-30-00.json
```

This directory is automatically created by the scripts and contains timestamped files for audit purposes.

---

## Support

For questions or issues with the token upgrade system, please:

1. Check this documentation
2. Review the script source code
3. Check the output files in `token-upgrade-data/`
4. Contact the development team

---

## Changelog

### 2024-11-11

- Initial creation of token upgrade system
- Added get-all-upgradable-tokens.ts
- Added upgrade-multiple-tokens.ts
- Added check-token-implementations.ts
- Created comprehensive documentation
