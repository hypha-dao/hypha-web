# VPP Fair-Split Settlement Engine

Processes 15-minute interval meter readings and produces `ConsumptionReading[]` for the `EnergyPPAv2.consumeEnergy()` smart contract. Implements the 3-pass fair-split algorithm described in `contracts/ENERGY_SYSTEM_README.md` Part 2.

## Files

| File | Description |
|---|---|
| `types.ts` | All shared TypeScript interfaces: `IntervalReading` (DB input), `SourceInfo` / `MemberInfo` / `OnChainConfig` (contract state), `FairSplitInput` / `FairSplitResult` (algorithm I/O), and `ConsumptionReading` (contract output). |
| `fair-split.ts` | The core 3-pass algorithm. Pure function, no I/O. Pass 1 allocates each member's ownership share per source (cheapest first). Pass 2 redistributes surplus to deficit members proportionally. Pass 3 assigns remaining deficit to grid import. Verifies energy and production balance invariants. |
| `on-chain-reader.ts` | Reads community configuration from a deployed EnergyPPAv2 contract via ethers.js: source registry, member list, ownership token balances (converted to basis points), export device ID, and fee config. |
| `build-readings.ts` | Transforms the algorithm's `FairSplitResult` into a flat `ConsumptionReading[]` matching the Solidity struct. One reading per (member, source) pair, plus grid import and export entries. Configurable `quantityScale` for unit conversion. |
| `run-interval.ts` | Orchestrator. Parses interval readings, reads on-chain config, runs the algorithm, and builds contract readings. Does not submit the transaction — returns data for the caller to send or dry-run. |
| `index.ts` | Barrel re-exports for all public functions and types. |
| `fair-split.test.ts` | 23 unit tests using `node:test`. Covers both worked examples from the README (import and export scenarios) plus edge cases: exact share, pure consumer, pure export, empty interval, deficit cap, rounding dust, and multi-iteration redistribution. |
| `__fixtures__/example1-import.json` | Test fixture for Example 1: 8 kWh solar + 2 kWh battery, 11 kWh demand, 1 kWh grid import. |
| `__fixtures__/example2-export.json` | Test fixture for Example 2: 10 kWh solar, 6 kWh demand, 4 kWh exported. |

## Run tests

```bash
cd packages/storage-evm && npx tsx --test vpp/fair-split.test.ts
```
