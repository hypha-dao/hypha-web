# EnergyPPAv2 Demo — Contracts, VPP & Scripts

On-chain energy settlement for a community of households and investors who co-own renewable energy sources (solar park, batteries). A backend VPP (Virtual Power Plant) service allocates energy fairly, then submits settlement readings to the smart contract which tracks credits, fees, and grid balance.

**Hypha UI — Enable Energy Community:** field-by-field explanations and copy-paste values aligned with this demo (plus notes on the AWS RDS loop) live in [`README-energy-demo-enable-energy-community-ui.md`](./README-energy-demo-enable-energy-community-ui.md).

## Contracts

| Contract | File | Purpose |
|---|---|---|
| **EnergyPPAv2** | `contracts/EnergyPPAv2.sol` | Core settlement contract. Receives `consumeEnergy(readings[])` calls from the backend. Each reading charges a consumer and credits source owners proportionally. Splits revenue per source: community fee → aggregator fee → ownership holders. Tracks a single `gridBalance` for import/export with the grid. Supports debt settlement and grid credit claims via stablecoin. |
| **EnergyPPAv2Factory** | `contracts/EnergyPPAv2Factory.sol` | Deploys a fully configured community in one transaction: creates the EnergyToken, UUPS proxies for EnergyPPAv2 and each RegularSpaceToken, registers sources, mints ownership tokens, adds members, and sets fees. |
| **EnergyToken** | `contracts/EnergyToken.sol` | ERC-20 token representing positive energy credit balances. Only the EnergyPPAv2 proxy can mint/burn. |
| **RegularSpaceToken** | `contracts/RegularSpaceToken.sol` | ERC-20 ownership token (one per energy source). Token balance determines each holder's revenue share from that source. E.g. 10% of solar tokens = 10% of solar revenue. |

### Key contract concepts

- **ConsumptionReading**: `{ deviceId, quantity (kWh), pricePerKwh (ct/kWh), sourceId }`. The charge = quantity × price (euro cents).
- **gridBalance**: Positive = grid owes community (net exporter). Negative = community owes grid (net importer).
- **Zero-sum invariant**: Sum of all member credits + community fee credit + aggregator fee credit − gridBalance + settledBalance = 0. Always.
- **1 credit = 1 euro cent**. Stablecoin conversion: 1 credit × 10,000 = stablecoin base units (for 6-decimal tokens like EURC).

## VPP Module

Off-chain TypeScript library that decides how to allocate energy before sending it to the contract.

| File | Purpose |
|---|---|
| `vpp/types.ts` | All TypeScript interfaces: `FairSplitInput`, `FairSplitResult`, `SourceInfo`, `MemberInfo`, `ConsumptionReading`, `TraceEvent`, etc. |
| `vpp/fair-split.ts` | The 3-pass fair-split algorithm. **Pass 1**: allocate each source's production to owners by ownership %. **Pass 2**: redistribute surplus from members who got more than they need to deficit members. **Pass 3**: remaining deficit is imported from the grid. Accepts an optional `trace` callback for detailed logging. |
| `vpp/build-readings.ts` | Converts `FairSplitResult` into `ConsumptionReading[]` ready for the contract. Handles Wh→kWh conversion, export readings, and grid import readings. |
| `vpp/fair-split.test.ts` | Unit tests for the fair-split algorithm using `node:test`. Covers surplus export, grid import, near-balanced, and cloudy scenarios with detailed trace output. |
| `vpp/on-chain-reader.ts` | Reads on-chain state (source ownership, member balances) for a deployed community. |
| `vpp/run-interval.ts` | Orchestrates a single 15-min interval: fetch data → fair-split → build readings → return. |
| `vpp/index.ts` | Barrel export for the VPP module. |

### Running VPP tests

```bash
cd packages/storage-evm
npx tsx --test vpp/fair-split.test.ts
```

## Scripts

All scripts live in `scripts/base-mainnet-contracts-scripts/` and run via Hardhat on Base mainnet.

### Core demo scripts (the ones we use)

| Script | Purpose | Command |
|---|---|---|
| **deploy-energy-ppa-v2-factory.ts** | Standalone factory deployment. Deploys EnergyPPAv2 implementation, RegularSpaceToken implementation, and the factory contract. Use when you only need the factory without a community. | `npx hardhat run scripts/base-mainnet-contracts-scripts/deploy-energy-ppa-v2-factory.ts --network base-mainnet` |
| **energy-ppav2-mainnet-demo.ts** | All-in-one demo script. Deploys a full community (factory + sources + members + fees), then runs randomized consumption intervals with on-chain submission. Supports `deploy`, `once`, `loop` commands via `ENERGY_DEMO_COMMAND` env var. | `ENERGY_DEMO_COMMAND=deploy npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-mainnet-demo.ts --network base-mainnet` |
| **energy-ppav2-vpp-loop.ts** | VPP fair-split + on-chain settlement loop. Uses the full 3-pass algorithm from `vpp/fair-split.ts` with detailed trace logging, builds contract readings, and submits on-chain. Most informative logs — shows each algorithm pass step by step. | `ENERGY_DEMO_COMMAND=once npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet` |
| **energy-ppav2-rds-loop.ts** | **Postgres interval path (Azure or legacy RDS):** connects with the `pg` driver (TLS on by default). Reads `accounting.interval_readings`, normalizes null directions, fetches spot grid prices (API with fallback), runs VPP fair-split, and submits `consumeEnergy` on-chain. Persists a local checkpoint so restarts continue from the last processed interval. | `ENERGY_DEMO_COMMAND=loop npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts --network base-mainnet` |
| **energy-ppav2-demo-state.json** | Stores the deployed community state (proxy address, token addresses, member addresses). Written by the deploy command, read by `once`/`loop` commands. | — |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `ENERGY_DEMO_COMMAND` | `loop` | `deploy` = deploy new community, `once` = run one batch, `loop` = run continuously, `reset` = call `emergencyReset()` |
| `ENERGY_DEMO_LOOP_MS` | `45000` | Milliseconds between batches in loop mode |
| `ENERGY_DB_POLL_MS` | `900000` | Poll interval for `energy-ppav2-rds-loop.ts` (15 minutes by default). Alias: `ENERGY_RDS_POLL_MS`. |
| `ENERGY_DB_CATCH_UP` | `0` | `1` = process all existing DB intervals from oldest on first run; `0` = initialize checkpoint at latest interval and process only new data. Alias: `ENERGY_RDS_CATCH_UP`. |
| `ENERGY_DB_CHECKPOINT_FILE` | `scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop-state.json` | Path to the local checkpoint file storing last processed interval. Alias: `ENERGY_RDS_CHECKPOINT_FILE`. |
| `ENERGY_DB_COMMUNITY_ID` | from state JSON | Community filter when reading `accounting.interval_readings`. Alias: `ENERGY_RDS_COMMUNITY_ID`. |
| `ENERGY_DB_HOST` | — | PostgreSQL host (required for `energy-ppav2-rds-loop.ts`). Alias: `ENERGY_RDS_HOST`. |
| `ENERGY_DB_PORT` | `5432` | PostgreSQL port. Alias: `ENERGY_RDS_PORT`. |
| `ENERGY_DB_DATABASE` | — | PostgreSQL database name. Alias: `ENERGY_RDS_DATABASE`. |
| `ENERGY_DB_USER` | — | PostgreSQL user. Alias: `ENERGY_RDS_USER`. |
| `ENERGY_DB_PASSWORD` | — | PostgreSQL password. Alias: `ENERGY_RDS_PASSWORD`. |
| `ENERGY_DB_SSL` | `1` | Set to `0` to disable SSL for DB connection. Alias: `ENERGY_RDS_SSL`. |
| `ENERGY_API_KEY` | — | `X-Api-Key` for Hypha Energy spot price API (`https://api.hypha.energy`). |
| `ENERGY_API_BASE_URL` | `https://api.hypha.energy` | Override API base URL for price fetcher. |
| `ENERGY_PRICE_MARKET` | `AT` | Spot market / `country_price_area` code for grid import price. |
| `ENERGY_GRID_IMPORT_CT` | `30` | Fallback grid import price in ct/kWh when API unavailable. |
| `ENERGY_GRID_EXPORT_CT` | `8` | Fallback grid export price in ct/kWh when API unavailable. |
| `DEPLOY_FACTORY` | — | Set to `1` to force deploying a new factory (instead of reusing existing) |
| `PRIVATE_KEY` | — | Deployer/admin wallet private key |

### Demo community layout

```text
Members:
  5 households (HH 1–5)   — each has a smart meter (device 1–5)
  2 investors  (Inv 1–2)  — no meters, pure revenue recipients

Energy sources:
  Solar park  — HH 1–5 own 10% each, Inv 1–2 own 25% each
  Battery 1   — Inv 1: 50%, Inv 2: 50%
  Battery 2   — Inv 2: 100%

Pricing (euro cents per kWh):
  Solar: 10    Battery 1: 15    Battery 2: 12
  Grid import: 30    Grid export: 8

Fees:
  Community: 5%    Aggregator: 3%

Roles:
  Community address — receives community fee revenue
  Aggregator address — receives aggregator fee revenue
  Grid operator — can claim grid export credits
```

## Hardhat tests

| Test | Purpose | Command |
|---|---|---|
| `test/EnergyPPAv2Functional.test.ts` | Full functional test suite: deployment, source registration, member management, `consumeEnergy`, fee distribution, zero-sum verification, settlement, grid balance, access control. | `npx hardhat test test/EnergyPPAv2Functional.test.ts` |
| `test/EnergyPPAv2Gas.test.ts` | Gas benchmarking: measures gas cost of `consumeEnergy` at various batch sizes (10, 50, 100+ readings) to ensure it fits within Base block gas limits. | `npx hardhat test test/EnergyPPAv2Gas.test.ts` |

## How settlement works

After `consumeEnergy` runs, every member has a credit balance — positive (earned money) or negative (owes money). These are just numbers on the contract. Settlement is the process of converting those numbers into real stablecoin transfers.

### The money flow

```text
Households consume energy   →  their balance goes negative (they owe money)
Investors own sources       →  their balance goes positive (they earned money)
Community/Aggregator fees   →  their balances go positive
Grid import shortfall       →  grid display goes positive  (community owes grid)
Grid export surplus         →  grid display goes negative  (grid owes community)

All balances always sum to zero.
```

> **Sign convention note:** The contract internally stores `gridBalance` with the opposite sign (positive = grid owes community). The scripts display `−gridBalance` so that all rows sum to zero: positive = someone has money or is owed money, negative = someone owes money.

### Paying a debt (negative balance → stablecoin in)

A household with balance `−150` (owes €1.50) calls `settleOwnDebt` or someone calls `settleDebt` on their behalf:

1. Caller sends stablecoins to the contract (e.g. 1,500,000 EURC base units = €1.50)
2. Contract converts: `stablecoinAmount / 10,000 = 150 internal credits`
3. Member's balance moves from `−150` toward `0`
4. `settledBalance` decreases by the same amount (tracks total settled)

Anyone can pay anyone's debt. The stablecoins stay in the contract — they become the pool that creditors can claim from.

### Claiming credit (positive balance → stablecoin out)

An investor with balance `+250` (earned €2.50) calls `claimCredit`:

1. Contract checks it holds enough stablecoins (someone must have settled debt first)
2. Balance moves from `+250` toward `0`
3. Contract sends stablecoins to the investor (2,500,000 EURC base units = €2.50)
4. `settledBalance` increases by the same amount

A whitelisted admin can also call `claimCreditFor` to claim on behalf of someone.

### Grid settlement

The grid has no wallet in the system — it has a `gridBalance` number.

- **Community owes grid** (`gridBalance < 0`): Anyone calls `settleGridDebt` and sends stablecoins. The stablecoins stay in the contract, `gridBalance` moves toward `0`.
- **Grid owes community** (`gridBalance > 0`): The designated **grid operator** (or admin) calls `claimGridCredit`. Contract sends stablecoins to the specified beneficiary address. `gridBalance` moves toward `0`.

The grid operator is set during deployment and can be changed by the admin. It could be someone from the grid company who claims the euros, or someone from Hypha who claims and does a bank transfer.

### Where do the stablecoins come from?

The contract itself holds stablecoins. The flow is:

```text
Debtors pay in (settleDebt)  →  stablecoins land in contract
                              →  creditors withdraw (claimCredit)
```

You can only claim if the contract has enough stablecoins. So debts must be settled before credits can be claimed. This is how the zero-sum is maintained in real money too.

### settledBalance

`settledBalance` is a bookkeeping counter. It tracks the net difference between all debt settlements and credit claims. In the zero-sum formula:

```text
sum(all member credits) + community + aggregator − gridBalance + settledBalance = 0
```

When someone settles a debt, their credit goes up (toward 0) and `settledBalance` goes down by the same amount. When someone claims credit, their credit goes down and `settledBalance` goes up. The formula stays balanced.

### Emergency reset

`emergencyReset()` (admin-only) zeros all balances, gridBalance, and settledBalance. Used during testing when balances get into a bad state. Does not move any stablecoins.

## Current deployment (Base mainnet)

See `energy-ppav2-demo-state.json` for live addresses. Key addresses:

- **Factory**: stored in state JSON
- **PPA Proxy**: the main contract you interact with
- **Energy Token**: ERC-20 for credit balances
- **Solar / Battery 1 / Battery 2 tokens**: ownership tokens

All deployed by `ENERGY_DEMO_COMMAND=deploy` via `energy-ppav2-mainnet-demo.ts`.
