# Energy Distribution Simulation

This script demonstrates a complete energy distribution cycle for a 5-household community energy sharing system.

## 🎯 What This Script Does

The simulation runs through a realistic day of energy management:

### 1. **Initial State Check**

- Shows battery status (80 kWh from previous day)
- Displays all household ownership percentages
- Shows empty energy pool (start of day)

### 2. **Energy Production & Distribution**

- **Solar Production**: 200 kWh at $0.10/kWh (community solar panels)
- **Grid Import**: 50 kWh at $0.30/kWh (peak demand supplement)
- **Total**: 250 kWh available for the community
- Automatically distributes energy tokens based on ownership:
  - Household 1: 30% = 75 kWh
  - Household 2: 25% = 62.5 kWh
  - Household 3: 20% = 50 kWh
  - Household 4: 15% = 37.5 kWh
  - Household 5: 10% = 25 kWh

### 3. **Energy Consumption**

- **Household 1**: 60 kWh (under-consumed: saves 15 kWh)
- **Household 2**: 40 kWh (under-consumed: saves 22.5 kWh)
- **Household 3**: 80 kWh (over-consumed: buys 30 kWh)
- **Household 4**: 30 kWh (under-consumed: saves 7.5 kWh)
- **Household 5**: 20 kWh (under-consumed: saves 5 kWh)
- **Grid Export**: 20 kWh sold back to utility

### 4. **Financial Settlement**

- Under-consumers earn credits for unused energy
- Over-consumers pay for extra energy purchased
- Export earnings are distributed to token owners
- All transactions in USDC (micro-cents precision)

### 5. **Final Verification**

- Shows final cash credit balances
- Displays remaining energy in collective pool
- Verifies transaction events and gas usage

## 🚀 How to Run

```bash
# Make sure you're in the packages/storage-evm directory
cd packages/storage-evm

# Run the simulation
npm run energy-simulation
```

## 📋 Prerequisites

- Contract must be configured with 5 households (use `npm run configure-energy:both`)
- Wallet must be the contract owner (for distribution/consumption functions)
- RPC_URL and accounts.json must be properly configured

## 🔍 What You'll See

The script provides detailed output showing:

- Energy allocation to each household
- Real-time cash credit balance changes
- Energy pool contents and pricing
- Transaction events and gas costs
- Final settlement results

## 💡 Understanding the Output

- **Allocated Tokens**: Energy each household earned from production
- **Cash Credit Balance**: Money owed to (+) or by (-) each household
- **Collective Pool**: Shared energy available for purchase
- **Export/Import Balances**: Community's position with the grid

This simulation demonstrates how the energy distribution system:

- ✅ Fairly allocates production based on ownership
- ✅ Enables efficient peer-to-peer energy trading
- ✅ Handles grid imports/exports automatically
- ✅ Settles payments transparently on-chain

## 🎉 Expected Result

A successful simulation proves your energy distribution contract is working perfectly for community energy management!
