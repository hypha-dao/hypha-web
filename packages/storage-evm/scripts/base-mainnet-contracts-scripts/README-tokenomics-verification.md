# Tokenomics Verification Scripts

This directory contains scripts to verify that the HYPHA token tokenomics are working as intended.

## Scripts

### 1. `test-tokenomics.ts`

**Purpose**: Simulates and analyzes the expected behavior when paying for spaces with HYPHA tokens.

**What it does**:

- Connects to the HYPHA token contract on Base mainnet
- Reads current contract state (pending distribution, multiplier, supply, etc.)
- Calculates expected reward generation for a 4 HYPHA payment
- Shows what should happen during the payment process
- Provides verification checklist

**Usage**:

```bash
npx ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/test-tokenomics.ts
```

**Expected Output**:

- Current contract state
- Tokenomics calculations showing 4 HYPHA → 40 HYPHA rewards
- Distribution timeline and emission rates
- Verification checklist

### 2. `verify-tokenomics-with-payment.ts`

**Purpose**: Comprehensive script that can actually execute the payment transaction (if private key provided) and verify the results.

**What it does**:

- All functionality of `test-tokenomics.ts`
- Can execute actual `payInHypha` transaction if `PRIVATE_KEY` env var is set
- Compares before/after state to verify correct tokenomics behavior
- Monitors reward distribution over time

**Usage**:

```bash
# Read-only mode (simulation)
npx ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/verify-tokenomics-with-payment.ts

# Live transaction mode (requires private key)
PRIVATE_KEY=your_private_key npx ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/verify-tokenomics-with-payment.ts
```

**Requirements for live execution**:

- Set `PRIVATE_KEY` environment variable
- Wallet must have sufficient HYPHA balance (at least 4 HYPHA)
- Wallet must have ETH for gas fees

### 3. `check-all-pending-rewards.ts`

**Purpose**: Checks pending rewards for multiple addresses to verify the reward distribution system.

**Usage**:

```bash
npx ts-node packages/storage-evm/scripts/base-mainnet-contracts-scripts/check-all-pending-rewards.ts
```

## Tokenomics Overview

Based on the HyphaToken contract analysis:

### Payment Process (`payInHypha`)

1. User pays X HYPHA tokens for space(s)
2. HYPHA tokens are transferred to the IEX address
3. Additional rewards = X × `distributionMultiplier` are generated
4. These rewards are added to `pendingDistribution`

### Reward Distribution

- Rewards are distributed over 24 hours (1 day)
- Distribution is proportional to token holdings
- Only eligible supply (excluding IEX address) receives rewards
- Emission rate = `pendingDistribution` / 86400 seconds

### Key Parameters

- **Distribution Multiplier**: 10 (default)
- **Distribution Period**: 24 hours
- **Eligible Recipients**: All HYPHA holders except IEX address

### Example Calculation

- Payment: 4 HYPHA
- Reward Generation: 4 × 10 = 40 HYPHA
- Distribution: 40 HYPHA over 24 hours
- Emission Rate: ~0.00046 HYPHA per second
- Hourly Rate: ~1.67 HYPHA per hour

## Verification Steps

To fully verify tokenomics are working:

1. **Run simulation**: Use `test-tokenomics.ts` to understand expected behavior
2. **Execute payment**: Use `verify-tokenomics-with-payment.ts` with private key
3. **Verify state changes**:
   - `pendingDistribution` should increase by payment × multiplier
   - User balance should decrease by payment amount
   - IEX address balance should increase by payment amount
4. **Monitor distribution**: Check that rewards are distributed over time
5. **Verify proportional distribution**: Users receive rewards proportional to their holdings

## Troubleshooting

### "missing revert data" errors

Some contract functions may return this error due to:

- Access restrictions on certain functions
- ABI mismatches
- Network connectivity issues

The scripts handle these gracefully and continue with available data.

### Network Issues

If RPC calls fail:

- Try a different Base mainnet RPC endpoint
- Check network connectivity
- Verify contract address is correct

### Transaction Failures

If `payInHypha` fails:

- Ensure sufficient HYPHA balance
- Check gas fees (need ETH)
- Verify space ID is valid
- Ensure IEX address is set in contract

## Contract Information

- **Network**: Base Mainnet
- **Contract Address**: `0x8b93862835C36e9689E9bb1Ab21De3982e266CD3`
- **RPC Endpoint**: `https://mainnet.base.org`

## Expected Results

When paying 4 HYPHA tokens:

- ✅ 4 HYPHA transferred to IEX address
- ✅ 40 HYPHA added to pending distribution
- ✅ Rewards distributed over 24 hours
- ✅ All HYPHA holders (except IEX) receive proportional rewards
- ✅ Accumulated reward per token increases over time
