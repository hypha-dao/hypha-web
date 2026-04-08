# Energy Distribution Accounting Bug Fix

## Issues Identified

### 1. **Zero-Sum Violation (Critical Bug)**

**Symptom:** After energy consumption, the system showed a -70,000 USDC cent imbalance instead of 0.

- Households total: -7,800,000 raw units (correct)
- Community balance: 800,000 raw units (INCORRECT - should be 7,800,000)
- **Missing**: 7,000,000 raw units (payments from H1-H4)

**Root Cause:** Multiple sequential calls to `_adjustCashCreditBalance()` on the same address (community) within a single transaction caused accounting errors in the burn/mint cycle.

**How it happened:**

```solidity
// OLD CODE - BUGGY
for each household {
  // Calculate self-consumption cost
  _adjustCashCreditBalance(communityAddress, cost);  // Called 5 times!
  _adjustCashCreditBalance(memberAddress, -totalCost);
}
```

Each call to `_adjustCashCreditBalance` triggers `_setCashCreditBalance`, which:

1. Burns ALL existing tokens
2. Resets balance to 0
3. Mints new total amount

When called multiple times rapidly on the same address, only the LAST call's effect persisted correctly.

### 2. **Distribution Prevention (Working as Designed) - FIXED**

**Initial Symptom:** Second distribution failed with error: "Previous energy distribution must be fully consumed before new distribution"

**Root Cause:** The test was consuming only 78 kWh out of 120 kWh distributed, leaving 42 kWh unconsumed. The contract correctly prevents new distributions while energy remains.

**Fix Applied:** Updated consumption requests to consume **exactly** the distributed amount:

- Distributed: 120 kWh (200 solar - 80 battery charge)
- Consumed: 120 kWh (36+30+24+18+12 matching ownership shares)
- **Remaining: 0 kWh** ✅

Each household now consumes 100% of their allocated energy (pure self-consumption), which:

- Maintains zero-sum accounting perfectly
- Allows subsequent distribution cycles
- Simplifies the test scenario

## Fixes Applied

### Fix 1: Batch Community Payments

**Location:** `_processMemberConsumption()` function

**Change:** Accumulate ALL self-consumption payments and credit community ONCE at the end:

```solidity
// NEW CODE - FIXED
int256 totalCommunityPayment = 0;

for each household {
  // Calculate self-consumption cost
  selfConsumptionCost = calculate...
  totalCommunityPayment += selfConsumptionCost;  // Accumulate
  _adjustCashCreditBalance(memberAddress, -totalCost);
}

// Credit community ONCE with total
if (totalCommunityPayment > 0) {
  _adjustCashCreditBalance(communityAddress, totalCommunityPayment);
}
```

**Impact:** Prevents multiple burn/mint cycles on community address, ensuring accurate accounting.

### Fix 2: Batch Export Payments

**Location:** `_processExportRequests()` function

**Change:** Accumulate export revenues per token owner and credit each owner ONCE:

```solidity
// Track revenues per owner using parallel arrays
address[] memory exportOwners = new address[](memberAddresses.length);
int256[] memory exportRevenues = new int256[](memberAddresses.length);

// Accumulate revenues...
for each batch {
  // Find or create owner entry
  // Add revenue to owner's total
}

// Credit all owners in batch
for each owner {
  _adjustCashCreditBalance(owner, revenue);
}
```

**Impact:** Prevents accounting errors when multiple batches belong to the same owner during export.

## Testing Instructions

### 1. Reset the System

Before testing, run emergency reset to clear the previous state:

```bash
cd packages/storage-evm/scripts/base-mainnet-contracts-scripts
ts-node emergency-reset.ts
```

### 2. Run Energy Simulation

Test the full cycle:

```bash
ts-node energy-simulation.ts
```

**Expected Results:**

- ✅ Energy distribution succeeds (120 kWh distributed)
- ✅ Energy consumption succeeds (120 kWh consumed - 100% of distributed)
- ✅ **Zero-sum verification passes**: Total balance = 0
- ✅ Community receives full payment: 12,000,000 raw units (120 USDC cents)
- ✅ All household balances are correct (each negative for their consumption)
- ✅ No remaining energy in pool (allows next distribution cycle)

### 3. Verify Zero-Sum Property

After consumption, check the output for:

```
💰 ZERO-SUM ACCOUNTING VERIFICATION:
   All Households + Community: 0 USDC cents
   Export Balance:             0 USDC cents
   Import Balance:             0 USDC cents
   ──────────────────────────────────────────
   TOTAL SUM:                  0 USDC cents (0 raw)
   ✅ PERFECT! Zero-sum property maintained
```

## Additional Notes

### Handling Unconsumed Energy

If you see "Previous energy distribution must be fully consumed", you have 3 options:

1. **Consume remaining energy**: Run consumption-only mode

   ```bash
   ts-node energy-simulation.ts consumption
   ```

2. **Export remaining energy**: Add export requests to consume the surplus

3. **Reset the system**: Use emergency reset (clears all state)
   ```bash
   ts-node emergency-reset.ts
   ```

### Storage Layout

No storage variables were modified, so this fix is **upgrade-safe**. The changes are purely in the execution logic.

### Zero-Sum Verification

The system maintains the zero-sum property:

```
Sum of all balances = 0
```

Where balances include:

- All member cash balances (households)
- Community cash balance
- Export cash balance (external debt to community)
- Import cash balance (external debt from community)
- Settled balance (external money brought in)

## Upgrade Deployment

To deploy this fix:

```bash
cd packages/storage-evm
npx hardhat run scripts/energy-distribution.upgrade.ts --network base
```

This will upgrade the implementation contract while preserving all existing state.
