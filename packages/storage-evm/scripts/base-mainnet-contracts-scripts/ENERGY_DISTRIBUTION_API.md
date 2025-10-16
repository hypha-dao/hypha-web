# Energy Distribution Accounting System - Developer API Guide

## 🔋 System Overview

This is an **accounting system** for energy distribution within a community microgrid. It tracks energy flows and maintains cash credit balances for all participants. The system doesn't physically distribute energy - it maintains the financial accounting of energy transactions.

**Main Output**: Cash credit balances showing who owes money and who has earned money from energy transactions.

## 📋 Main Functions

### 1. Distribute Energy Tokens

**Function**: `distributeEnergyTokens(EnergySource[] sources, uint256 batteryState)`

Records energy production from various sources and allocates them to community members.

#### Input Parameters

**`sources`** - Array of energy sources:

```solidity
struct EnergySource {
    uint256 sourceId;    // Unique identifier (1=solar, 2=wind, etc.)
    uint256 price;       // Price in 6-decimal USDC (e.g., 100000 = $0.10/kWh)
    uint256 quantity;    // Energy amount in kWh
    bool isImport;       // true = grid import, false = local production
}
```

**`batteryState`** - Current battery charge level in kWh

#### Example Usage

```javascript
const energySources = [
  {
    sourceId: 1, // Solar production
    price: ethers.parseUnits('0.08', 6), // $0.08 per kWh
    quantity: 100, // 100 kWh
    isImport: false, // Local production
  },
  {
    sourceId: 2, // Grid import
    price: ethers.parseUnits('0.30', 6), // $0.30 per kWh
    quantity: 50, // 50 kWh
    isImport: true, // Grid import
  },
];

await contract.distributeEnergyTokens(energySources, 0);
```

---

### 2. Consume Energy Tokens

**Function**: `consumeEnergyTokens(ConsumptionRequest[] consumptionRequests)`

Processes energy consumption and updates cash credit balances automatically.

#### Input Parameters

**`consumptionRequests`** - Array of consumption requests:

```solidity
struct ConsumptionRequest {
    uint256 deviceId;    // Device/household ID (1-5 for households, 1000 for export)
    uint256 quantity;    // Energy amount to consume in kWh
}
```

#### Example Usage

```javascript
const consumptionRequests = [
  { deviceId: 1, quantity: 25 }, // Household 1 consumes 25 kWh
  { deviceId: 2, quantity: 20 }, // Household 2 consumes 20 kWh
  { deviceId: 1000, quantity: 10 }, // Export 10 kWh to grid
];

await contract.consumeEnergyTokens(consumptionRequests);
```

#### Device IDs

- **1-5**: Household consumption devices
- **1000**: Export device (sells to grid)

---

## 📊 View Functions (Read-Only)

### Cash Credit Balance

**Function**: `getCashCreditBalance(address member) → int256`

Returns the cash credit balance for a specific member.

#### Input

- **`member`**: Member's wallet address

#### Output

- **`int256`**: Balance in 6-decimal USDC
  - Positive = member has credit (earned money)
  - Negative = member owes money (spent on energy)

#### Example

```javascript
const [balance] = await contract.getCashCreditBalance('0x123...');
const balanceUSDC = Number(balance) / 1000000; // Convert to USDC
console.log(`Balance: $${balanceUSDC.toFixed(2)}`);
```

### System Balances

```javascript
// Import balance (money owed to grid for imported energy)
const importBalance = await contract.getImportCashCreditBalance();

// Export balance (money owed by grid for exported energy)
const exportBalance = await contract.getExportCashCreditBalance();
```

### Zero-Sum Verification

```javascript
const [isZeroSum, balance] = await contract.verifyZeroSumProperty();
console.log(`Zero-sum status: ${isZeroSum ? 'PASS' : 'FAIL'}`);
```

---

## 💡 Complete Example

```javascript
// 1. Distribute energy from multiple sources
const sources = [
  { sourceId: 1, price: ethers.parseUnits('0.08', 6), quantity: 100, isImport: false }, // Solar
  { sourceId: 2, price: ethers.parseUnits('0.35', 6), quantity: 50, isImport: true }, // Import
];
await contract.distributeEnergyTokens(sources, 0);

// 2. Members consume energy (automatic price optimization)
const consumption = [
  { deviceId: 1, quantity: 30 }, // Household 1: 30 kWh
  { deviceId: 2, quantity: 25 }, // Household 2: 25 kWh
];
await contract.consumeEnergyTokens(consumption);

// 3. Check results
const [h1Balance] = await contract.getCashCreditBalance(household1Address);
console.log(`Household 1 balance: $${Number(h1Balance) / 1000000}`);
```

## 🔧 Helper Functions

```javascript
function formatUSDC(rawAmount) {
  return (Number(rawAmount) / 1000000).toFixed(2);
}

function parseUSDC(dollarAmount) {
  return ethers.parseUnits(dollarAmount.toString(), 6);
}
```

---

## 📍 Contract & Member Addresses

### Contract Address (Base Mainnet)

```
0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95
```

### Community Member Addresses

```javascript
const HOUSEHOLD_ADDRESSES = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a', // Household 1 (30% ownership)
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Household 2 (25% ownership)
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Household 3 (20% ownership)
  '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Household 4 (15% ownership)
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Household 5 (10% ownership)
];
```

### Community Address

```
0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
```

_This address receives payments from self-consumption and manages community funds._

---

## 🔧 Exact Function ABIs

### 1. Distribute Energy Tokens

```json
{
  "inputs": [
    {
      "components": [
        { "internalType": "uint256", "name": "sourceId", "type": "uint256" },
        { "internalType": "uint256", "name": "price", "type": "uint256" },
        { "internalType": "uint256", "name": "quantity", "type": "uint256" },
        { "internalType": "bool", "name": "isImport", "type": "bool" }
      ],
      "internalType": "struct IEnergyDistribution.EnergySource[]",
      "name": "sources",
      "type": "tuple[]"
    },
    { "internalType": "uint256", "name": "batteryState", "type": "uint256" }
  ],
  "name": "distributeEnergyTokens",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

### 2. Consume Energy Tokens

```json
{
  "inputs": [
    {
      "components": [
        { "internalType": "uint256", "name": "deviceId", "type": "uint256" },
        { "internalType": "uint256", "name": "quantity", "type": "uint256" }
      ],
      "internalType": "struct IEnergyDistribution.ConsumptionRequest[]",
      "name": "consumptionRequests",
      "type": "tuple[]"
    }
  ],
  "name": "consumeEnergyTokens",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

### 3. Get Cash Credit Balance

```json
{
  "inputs": [{ "internalType": "address", "name": "member", "type": "address" }],
  "name": "getCashCreditBalance",
  "outputs": [{ "internalType": "int256", "name": "", "type": "int256" }],
  "stateMutability": "view",
  "type": "function"
}
```

### 4. Emergency Reset (Restart System)

```json
{
  "inputs": [],
  "name": "emergencyReset",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

---

## ⚠️ Critical Requirements

### Distribution and Consumption Must Balance

**Simple Rule**: All distributed energy MUST be consumed before new distribution.

#### Why This Matters

- **Distribution**: Creates energy tokens available for consumption
- **Consumption**: Uses up the energy tokens (household use + exports)
- **Balance**: Total consumption must equal total distribution

#### Example Flow

```javascript
// 1. Distribute 100 kWh total
const sources = [{ sourceId: 1, price: ethers.parseUnits('0.08', 6), quantity: 100, isImport: false }];
await contract.distributeEnergyTokens(sources, 0);

// 2. Consume ALL 100 kWh (household use + exports)
const consumption = [
  { deviceId: 1, quantity: 30 }, // Household 1: 30 kWh
  { deviceId: 2, quantity: 20 }, // Household 2: 20 kWh
  { deviceId: 1000, quantity: 50 }, // Export: 50 kWh
  // Total: 30 + 20 + 50 = 100 kWh ✅
];
await contract.consumeEnergyTokens(consumption);

// 3. Now ready for next distribution cycle
```

#### Example with Battery Operations

```javascript
// 1. Distribute 80 kWh solar + battery charging (30 kWh)
const sources = [{ sourceId: 1, price: ethers.parseUnits('0.08', 6), quantity: 80, isImport: false }];
await contract.distributeEnergyTokens(sources, 30); // Battery charges to 30 kWh
// Result: 80 kWh - 30 kWh battery charge = 50 kWh available

// 2. Consume the 50 kWh available
const consumption1 = [
  { deviceId: 1, quantity: 25 }, // Household 1: 25 kWh
  { deviceId: 2, quantity: 25 }, // Household 2: 25 kWh
  // Total: 25 + 25 = 50 kWh ✅ (matches available energy)
];
await contract.consumeEnergyTokens(consumption1);

// 3. Later: Battery discharging (30 → 10 kWh) + new solar
const sources2 = [{ sourceId: 1, price: ethers.parseUnits('0.08', 6), quantity: 20, isImport: false }];
await contract.distributeEnergyTokens(sources2, 10); // Battery discharges 20 kWh
// Result: 20 kWh solar + 20 kWh battery discharge = 40 kWh available

// 4. Consume all 40 kWh
const consumption2 = [
  { deviceId: 1, quantity: 40 }, // Household 1: 40 kWh
  // Total: 40 kWh ✅ (matches solar + battery discharge)
];
await contract.consumeEnergyTokens(consumption2);
```

#### What Happens If Unbalanced

- **Under-consumption**: `Previous energy distribution must be fully consumed before new distribution`
- **Over-consumption**: `Insufficient energy tokens available`

#### Required Before Each Distribution

- All previous energy tokens must be consumed (household use + exports)
- Energy pool must be empty (0 kWh remaining)
- Use exports to clear remaining member-owned energy

---

## ⚠️ Important Notes

- **Price Format**: All prices in 6-decimal USDC (1,000,000 = $1.00)
- **Zero-Sum**: System maintains perfect balance - all credits and debits sum to zero
- **Automatic Logic**: System handles price optimization and payment routing automatically
- **Main Output**: Cash credit balances showing financial positions
