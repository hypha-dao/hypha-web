# Energy Distribution Contract Configuration

This script configures the Energy Distribution contract on Base Mainnet with battery settings, device IDs, and community members. **Configured for 5 households with different ownership percentages (30%, 25%, 20%, 15%, 10%).**

**⚡ Energy Unit Conversion: 1 contract unit = 1 kWh**

## Contract Address

- **Energy Distribution**: `0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95`

## Prerequisites

1. **Environment Setup**: Create a `.env` file with:

   ```
   RPC_URL=https://mainnet.base.org
   PRIVATE_KEY=your_private_key_here
   ENERGY_DISTRIBUTION_ADDRESS=0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95
   ```

2. **Account Setup**: Either:

   - Set `PRIVATE_KEY` in `.env` file, OR
   - Create `accounts.json` with account data:
     ```json
     [
       {
         "privateKey": "your_private_key_without_0x",
         "address": "0xYourAddress"
       }
     ]
     ```

3. **Permissions**: The account must be the owner of the Energy Distribution contract.

## Available Commands

### Configure the Contract

```bash
# Full configuration (battery, devices, 5 households)
npm run configure-energy

# Or run directly
npx ts-node scripts/base-mainnet-contracts-scripts/configure-energy-distribution.ts configure
```

### View Current State

```bash
# View current contract configuration
npm run configure-energy:view

# Or run directly
npx ts-node scripts/base-mainnet-contracts-scripts/configure-energy-distribution.ts view
```

### Configure and View

```bash
# Configure and then view the results
npm run configure-energy:both

# Or run directly
npx ts-node scripts/base-mainnet-contracts-scripts/configure-energy-distribution.ts both
```

## Configuration Details

### Default Configuration - 5 Households

The script is configured for **5 households with different ownership percentages**:

**Energy Conversion: 1 contract unit = 1 kWh**

```typescript
const DEFAULT_CONFIG = {
  battery: {
    price: ethers.parseUnits('0.25', 6), // 0.25 USDC per kWh (realistic storage cost)
    maxCapacity: 150, // 150 kWh capacity (sized for 5 households)
  },
  exportDeviceId: 1000, // Special ID for export device
  communityDeviceId: 1001, // Special ID for community device
  members: [
    // Household 1 - 30% ownership, Device ID: 1
    { address: '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', deviceIds: [1], ownershipPercentage: 3000 },
    // Household 2 - 25% ownership, Device ID: 2
    { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', deviceIds: [2], ownershipPercentage: 2500 },
    // Household 3 - 20% ownership, Device ID: 3
    { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', deviceIds: [3], ownershipPercentage: 2000 },
    // Household 4 - 15% ownership, Device ID: 4
    { address: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', deviceIds: [4], ownershipPercentage: 1500 },
    // Household 5 - 10% ownership, Device ID: 5
    { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', deviceIds: [5], ownershipPercentage: 1000 },
  ],
};
```

### Configuration Steps

The script performs these actions in order:

1. **🔋 Battery Configuration**

   - Sets battery price per kWh (0.25 USDC per kWh)
   - Sets maximum battery capacity (150 kWh for 5 households)
   - Energy conversion: 1 contract unit = 1 kWh
   - Emits `BatteryConfigured` event

2. **📤 Export Device Setup**

   - Sets the device ID for energy exports (ID: 1000)
   - Emits `ExportDeviceIdSet` event

3. **🏘️ Community Device Setup**

   - Sets the device ID for community/shared usage (ID: 1001)
   - Emits `CommunityDeviceIdSet` event

4. **👥 Household Management**
   - Adds 5 households with their individual device IDs (1, 2, 3, 4, 5)
   - Sets different ownership percentages based on contribution:
     - Household 1: 30% (3000 basis points) - Largest contributor
     - Household 2: 25% (2500 basis points) - Second largest
     - Household 3: 20% (2000 basis points) - Medium contributor
     - Household 4: 15% (1500 basis points) - Smaller contributor
     - Household 5: 10% (1000 basis points) - Smallest contributor
   - Validates total ownership equals exactly 100% (10000 basis points)
   - Emits `MemberAdded` event for each household

## Important Notes

### 5-Household Community Structure

- **Total Households**: 5
- **Ownership Distribution**: Varied based on contribution (30%, 25%, 20%, 15%, 10%)
- **Device IDs**: 1, 2, 3, 4, 5 (one per household)
- **Special Devices**: Export (1000), Community (1001)
- **Battery Capacity**: 150 kWh (realistic for 5 households)
- **Energy Units**: 1 contract unit = 1 kWh
- **Battery Cost**: $0.25 per kWh stored energy

### Ownership Percentages

- Use basis points: 10000 = 100%
- Household ownership varies by contribution level:
  - **30%** (3000 basis points) - Largest contributor with most solar panels
  - **25%** (2500 basis points) - Second largest contributor
  - **20%** (2000 basis points) - Medium-sized contribution
  - **15%** (1500 basis points) - Smaller contribution
  - **10%** (1000 basis points) - Smallest contribution
- Total ownership: 3000 + 2500 + 2000 + 1500 + 1000 = 10000 (100%)
- The contract validates that total ownership equals exactly 100%

### Device IDs

- **Household devices**: 1, 2, 3, 4, 5 (one per household)
- **Export device**: 1000 (special - for selling excess energy to grid)
- **Community device**: 1001 (special - for shared/community usage)
- Each device ID can only be assigned to one household
- Regular household device IDs don't conflict with special IDs

### Battery Configuration

- **Energy Units**: 1 contract unit = 1 kWh (direct conversion)
- **Price**: 0.25 USDC per kWh (realistic for battery storage)
- **Capacity**: 150 kWh (appropriate for 5-household community)
- **Daily Usage Context**: ~25-30 kWh per household = 125-150 kWh total
- **Backup Duration**: ~1 day of full community backup power
- Battery must be configured before it can be used for charging/discharging

## Example Usage

1. **Initial Setup**:

   ```bash
   # Configure everything from scratch
   npm run configure-energy
   ```

2. **Check Status**:

   ```bash
   # View current configuration
   npm run configure-energy:view
   ```

3. **Full Workflow**:
   ```bash
   # Configure and immediately view results
   npm run configure-energy:both
   ```

## Real-World Community Setup

This configuration represents a realistic energy-sharing community with varied contributions:

- **🏠 Household 1**: Large house with extensive solar array on Device ID 1 → **30% ownership**
- **🏠 Household 2**: Medium-large house with good solar setup on Device ID 2 → **25% ownership**
- **🏠 Household 3**: Standard house with typical solar panels on Device ID 3 → **20% ownership**
- **🏠 Household 4**: Smaller house with modest solar setup on Device ID 4 → **15% ownership**
- **🏠 Household 5**: Small house with minimal solar panels on Device ID 5 → **10% ownership**
- **🔋 Shared Battery**: 150 kWh capacity for community energy storage
- **📤 Export System**: Sells excess community energy to the grid
- **🏘️ Community Pool**: Manages shared energy consumption

**Energy Economics (1 unit = 1 kWh):**

- **Daily Community Usage**: ~125-150 kWh (25-30 kWh per household)
- **Battery Backup**: ~1 day of full community power
- **Storage Cost**: $0.25 per kWh (competitive with grid rates)
- **Direct Conversion**: No complex unit calculations needed

**Benefits of Different Ownership:**

- Reflects actual solar panel capacity and investment levels
- Fair distribution based on energy contribution potential
- Incentivizes larger renewable energy installations
- More realistic for real-world community energy projects

## Customizing for Different Scenarios

To modify for a different number of households or ownership distribution:

```typescript
// Example: 3 households with different ownership
const CUSTOM_CONFIG = {
  battery: {
    price: ethers.parseUnits('0.30', 6), // 0.30 USDC per kWh
    maxCapacity: 100, // 100 kWh for 3 households
  },
  exportDeviceId: 1000,
  communityDeviceId: 1001,
  members: [
    { address: '0x...', deviceIds: [1], ownershipPercentage: 4000 }, // 40%
    { address: '0x...', deviceIds: [2], ownershipPercentage: 3500 }, // 35%
    { address: '0x...', deviceIds: [3], ownershipPercentage: 2500 }, // 25%
    // Total: 10000 basis points (100%)
  ],
};
```

## Troubleshooting

### Common Issues

1. **"Ownable: caller is not the owner"**

   - Ensure your account is the contract owner
   - Check that you're using the correct private key

2. **"Member already exists"**

   - A household with that address is already added
   - Use `removeMember()` first if you need to update

3. **"Device ID already assigned"**

   - Device IDs must be unique across all households
   - Check for duplicate device IDs in your configuration

4. **"Total ownership exceeds 100%"**
   - Sum of all ownership percentages exceeds 10000 basis points
   - For these 5 households: 3000 + 2500 + 2000 + 1500 + 1000 = 10000 ✅

### Gas Considerations

- Each transaction requires gas fees on Base Mainnet
- Battery configuration: ~50,000 gas
- Setting device IDs: ~30,000 gas each
- Adding households: ~100,000 gas per household
- **Total for 5 households**: ~600,000 gas

## Security Notes

- Only the contract owner can perform configuration
- Keep your private key secure
- Test with small amounts first
- Verify all addresses and device IDs before running
- Each household address should be controlled by the respective household

## Contract Functions Used

- `configureBattery(uint256 price, uint256 maxCapacity)`
- `setExportDeviceId(uint256 deviceId)`
- `setCommunityDeviceId(uint256 deviceId)`
- `addMember(address memberAddress, uint256[] deviceIds, uint256 ownershipPercentage)`
- View functions for status checking

For more details, see the contract implementation at `contracts/EnergyDistributionImplementation.sol`.
