# Emergency Reset - Quick Start

## TL;DR

The EnergyToken is corrupted. Deploy a new one and reconfigure the system.

## Fastest Path to Success

```bash
cd /Users/vlad/hypha-web/packages/storage-evm/scripts/base-mainnet-contracts-scripts

# Option 1: Fully automated (recommended)
ts-node fix-energy-token-complete.ts
ts-node emergency-reset.ts execute

# Option 2: Interactive guide
ts-node START-HERE.ts
```

## What's Wrong?

- ❌ EnergyToken at `0xd8724e6609838a54F7e505679BF6818f1A3F2D40` has corrupted storage
- ❌ `authorized()` mapping is broken (reads wrong storage slot)
- ❌ Can't authorize EnergyDistribution to burn tokens
- ❌ Emergency reset fails

## Why?

Someone upgraded the proxy from `EnergyToken` → `RegularSpaceToken` which have **incompatible storage layouts**:

```
RegularSpaceToken:           EnergyToken:
- Slot 0: spaceId            - Slot 0: authorized mapping
- Slot 1: maxSupply
- Slot 2: transferable
- Slot 3+: authorized ❌

→ authorized() reads wrong slot!
```

## The Fix

1. Deploy NEW EnergyToken (correct implementation)
2. Update EnergyDistribution to use new token
3. Authorize EnergyDistribution in new token
4. Run emergency reset

## Scripts Available

| Script                          | Purpose                         |
| ------------------------------- | ------------------------------- |
| `START-HERE.ts`                 | Interactive menu & status check |
| `fix-energy-token-complete.ts`  | **Automated everything** ⭐     |
| `authorize-for-reset.ts`        | Authorize EnergyDistribution    |
| `emergency-reset.ts`            | Reset all balances              |
| `check-token-implementation.ts` | Debug token setup               |
| `debug-token-authorization.ts`  | Debug authorization issues      |

## Full Documentation

See `FIX-ENERGY-TOKEN-GUIDE.md` for complete details.

## Key Addresses

- **Corrupted Token**: `0xd8724e6609838a54F7e505679BF6818f1A3F2D40`
- **EnergyDistribution**: `0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95`
- **New Token**: Deploy to get address

## Questions?

Run the diagnostic script:

```bash
ts-node START-HERE.ts
```

It will show you current status and guide you through the fix.
