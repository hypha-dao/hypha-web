# EnergyPPAv2 Demo - Comprehensive Smart Contract and Flow Documentation

This document explains the full EnergyPPAv2 demo: what the smart contracts do, how the Virtual Power Plant (VPP) allocates energy, how interval data turns into on-chain accounting, and how debts, credits, fees, and grid balances are settled.

It complements:

- `README-energy-demo.md` - short operator reference
- `README-energy-demo-enable-energy-community-ui.md` - Hypha UI field guide
- `ENERGY_INTERVAL_DATA_FEED.md` - 15-minute meter data feed contract

## Executive Summary

The demo models an energy community where households consume electricity and households/investors co-own local energy sources. The local sources are a solar park and two batteries. An off-chain VPP allocates production fairly for each 15-minute interval, then sends the resulting settlement readings to `EnergyPPAv2.consumeEnergy`.

On-chain, `EnergyPPAv2` does not run the physical optimization algorithm. It is the accounting and settlement layer:

1. It maps smart meter device IDs to member addresses.
2. It charges consumers for energy readings.
3. It accumulates revenue per energy source.
4. It splits source revenue into community fee, aggregator fee, and owner revenue.
5. It tracks grid import/export as one `gridBalance`.
6. It lets negative balances be paid in stablecoin and positive balances be claimed.
7. It enforces the zero-sum invariant after each `consumeEnergy` call.

The live reference deployment is on Base mainnet:

| Item | Address / value |
|---|---|
| Chain | Base mainnet, chain ID `8453` |
| Factory | `0xB8e042Bc361d1D44Cfe408667B63fAe7E10B90ef` |
| PPA proxy | `0xd0BCe7dfE24c1df30cA7aBe77A7feeF2679ebe1b` |
| Energy token | `0x483480996d6E373D2E6621ce89B984e78988268B` |
| Community ID | `0` |
| Stablecoin | Base USDC, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Current live addresses are stored in `scripts/base-mainnet-contracts-scripts/energy-ppav2-demo-state.json`.

## System Architecture

```text
15-minute meter data
        |
        v
AWS RDS accounting.interval_readings
        |
        v
energy-ppav2-rds-loop.ts
        |
        v
VPP fair-split algorithm
        |
        v
ConsumptionReading[]
        |
        v
EnergyPPAv2.consumeEnergy()
        |
        +--> household balances
        +--> source owner balances
        +--> community / aggregator fee balances
        +--> gridBalance
        +--> EnergyToken balances for positive credits
        |
        v
Stablecoin settlement and credit claims
```

The off-chain VPP decides which household consumed which local source and which portion was imported from or exported to the grid. The contract receives that decision as a flat list of readings and turns it into auditable balances.

## Demo Community

The reference demo has seven members:

| Role | Count | Device IDs | Purpose |
|---|---:|---|---|
| Households | 5 | `1`, `2`, `3`, `4`, `5` | Consume energy and own part of the solar source |
| Investors | 2 | none | Own source tokens and receive revenue |

The sources are:

| Source | Source ID | Type | Price | Ownership |
|---|---|---|---:|---|
| Solar park | `0x06c8993185e0aa106cc6c3ed3ad7ee2f631d21689edc12b5835e9e0cab8cef9b` | `SOLAR` | `10` ct/kWh | HH1-HH5 10% each, Investor 1 25%, Investor 2 25% |
| Battery 1 | `0x0da3b72be79353eef15b379e1c635befa93722bb4d116f89053462ee538d56a6` | `BATTERY` | `15` ct/kWh | Investor 1 50%, Investor 2 50% |
| Battery 2 | `0x7b2e151b60588c1b6572871f701ff4a9d9626fbe26df6d4363ba9517941a68f4` | `BATTERY` | `12` ct/kWh | Investor 2 100% |

Other configured values:

| Item | Value |
|---|---:|
| Grid import price | `30` ct/kWh |
| Grid export price | `8` ct/kWh |
| Community fee | `500` bps = 5% |
| Aggregator fee | `300` bps = 3% |
| Export device ID | `9999` |

## Smart Contracts

### `EnergyPPAv2`

File: `contracts/EnergyPPAv2.sol`

`EnergyPPAv2` is the main accounting contract. It is UUPS upgradeable and owned by the community admin. Only whitelisted accounts can submit energy readings and perform most operational configuration.

The core state is:

| State | Meaning |
|---|---|
| `sources` | Registry of source IDs to source type, ownership token, base price, and active flag |
| `sourceIds` | Iterable list of registered sources used for revenue distribution |
| `members` | Registered member records with address, device IDs, active status, and metadata hash |
| `deviceToMember` | Meter/device ID to member address lookup |
| `energyCreditBalances` | Negative balances for accounts that owe money |
| `energyToken` | ERC-20 representation of positive balances |
| `gridBalance` | Net grid position; negative means community owes grid, positive means grid owes community |
| `settledBalance` | Bookkeeping counter used to keep settled stablecoin flows zero-sum |
| `communityFeeBps` / `aggregatorFeeBps` | Fee rates applied to each source's gross revenue |
| `communityAddress` / `aggregatorAddress` | Fee recipient accounts |
| `exportDeviceId` | Special device ID used to mark export readings |
| `stablecoinAddress` | ERC-20 used for real settlement |
| `gridOperatorAddress` | Account allowed to claim positive grid credit |
| `isWhitelisted` | Operational allowlist for backend/admin accounts |

The important public methods are:

| Method | Purpose |
|---|---|
| `initialize` | Sets owner, energy token, stablecoin, payment recipient, and grid operator |
| `registerSource` | Adds a source and its ownership token |
| `updateSourceBasePrice` | Updates the source's reference price |
| `deactivateSource` | Stops a source from being used in new readings |
| `addMember` | Registers a member and maps their device IDs |
| `removeMember` | Removes a member, device mappings, and any tracked balance |
| `consumeEnergy` | Processes interval readings and distributes revenue |
| `settleDebt` / `settleOwnDebt` | Pays a negative member balance with stablecoin |
| `claimCredit` / `claimCreditFor` | Withdraws stablecoin for a positive member balance |
| `settleGridDebt` | Pays a negative grid balance |
| `claimGridCredit` | Claims a positive grid balance to a beneficiary |
| `verifyZeroSum` | Checks the accounting invariant |
| `emergencyReset` | Clears member, fee, grid, and settlement balances for testing |

### `EnergyPPAv2Factory`

File: `contracts/EnergyPPAv2Factory.sol`

The factory deploys a complete community in one transaction. It creates:

1. An `EnergyToken`.
2. A UUPS proxy for `EnergyPPAv2`.
3. A UUPS `RegularSpaceToken` proxy for each source.
4. Source registrations.
5. Initial source ownership token balances.
6. Member registrations.
7. Fee, export device, grid operator, owner, and whitelist configuration.

The key input is `CommunityParams`, which contains:

- Admin address
- Stablecoin address
- Community and aggregator fee recipient addresses
- Grid operator address
- Community and aggregator fee BPS
- Export device ID
- Energy token name and symbol
- Source configurations
- Member configurations

Deployment order matters. The factory temporarily owns the PPA proxy so it can configure the community, then it whitelists the admin, removes itself from the whitelist, and transfers ownership to the admin.

### `EnergyToken`

File: `contracts/EnergyToken.sol`

`EnergyToken` is an ERC-20 used to represent positive energy credit balances. The PPA contract is authorized to mint and burn it.

Important behavior:

- Positive balances are represented by actual ERC-20 token balances.
- Negative balances are stored in `EnergyPPAv2.energyCreditBalances`.
- `decimals()` returns `6`, matching USDC-style stablecoin precision.
- Only authorized contracts can mint/burn.

`EnergyPPAv2` uses a single logical balance API:

```text
if EnergyToken balance > 0:
  account balance = positive token balance
else:
  account balance = stored signed balance
```

This means an account is never meant to simultaneously hold a positive token balance and a negative stored balance.

### `RegularSpaceToken`

File: `contracts/RegularSpaceToken.sol`

Each energy source gets one ownership token. The token balance determines the holder's share of revenue from that source.

In this demo, the factory deploys three ownership token proxies:

| Token | Source | Meaning |
|---|---|---|
| `D-SOLAR` | Solar park | Solar revenue ownership |
| `D-BAT1` | Battery 1 | Battery 1 revenue ownership |
| `D-BAT2` | Battery 2 | Battery 2 revenue ownership |

The demo mints ownership amounts out of `10,000`, so token balances map directly to basis points:

```text
1,000 / 10,000 = 10%
2,500 / 10,000 = 25%
5,000 / 10,000 = 50%
10,000 / 10,000 = 100%
```

## `consumeEnergy` in Detail

The contract input is:

```solidity
struct ConsumptionReading {
  uint256 deviceId;
  uint256 quantity;
  uint256 pricePerKwh;
  bytes32 sourceId;
}
```

The backend submits one reading for every relevant allocation:

- Household consumed solar: household device ID + solar source ID.
- Household consumed battery energy: household device ID + battery source ID.
- Household imported from grid: household device ID + `IMPORT_SOURCE_ID`.
- Source exported to grid: export device ID `9999` + source ID.

The contract computes:

```text
charge = quantity * pricePerKwh
```

In the current VPP loop, the algorithm works in Wh, then converts Wh to kWh by dividing by `1000` before submission. Prices are integer cents per kWh, so the internal balance unit is one euro cent.

### Phase 1 - Charge Consumers and Accumulate Revenue

For normal household readings:

1. The contract resolves `deviceId` to a member address.
2. The member's balance decreases by `quantity * pricePerKwh`.
3. If `sourceId == IMPORT_SOURCE_ID`, `gridBalance` decreases because the community owes the grid.
4. Otherwise, the charge is accumulated as revenue for that local source.

For export readings:

1. The reading is identified by `deviceId == exportDeviceId`.
2. The contract rejects export from `IMPORT_SOURCE_ID`.
3. The source receives export revenue.
4. `gridBalance` increases because the grid owes the community for exported energy.

### Phase 2 - Split Source Revenue

For each source with revenue:

1. Community fee is taken from total source revenue.
2. Aggregator fee is taken from total source revenue.
3. Remaining revenue is split pro-rata among holders of that source's ownership token.
4. The last holder receives rounding dust so the full remaining amount is distributed.

Example with `1,000` cents of solar revenue:

```text
Gross solar revenue:       1,000
Community fee, 5%:            50
Aggregator fee, 3%:           30
Remaining for owners:        920

HH1-HH5, 10% each:            92 each
Investor 1, 25%:             230
Investor 2, 25%:             230
```

The contract enforces zero-sum after the full call.

## Accounting Model

The main invariant is:

```text
sum(member balances)
+ community fee balance
+ aggregator fee balance
- gridBalance
+ settledBalance
= 0
```

Sign conventions:

| Balance | Positive means | Negative means |
|---|---|---|
| Member balance | Account earned money and can claim | Account owes money |
| `gridBalance` | Grid owes the community | Community owes the grid |
| `settledBalance` | More credit has been claimed than debt paid, in bookkeeping terms | More debt has been paid than credit claimed |

The scripts sometimes display `-gridBalance` so the grid row reads like a normal account row: positive display means the grid is owed money, negative display means the grid owes money.

## Stablecoin Settlement

Internal credits are denominated as euro-cent-style integer units:

```text
1 internal credit = 1 cent
1 internal credit * 10,000 = stablecoin base units
```

For a 6-decimal stablecoin such as USDC or EURC:

```text
10,000 base units = 0.01 token = 1 cent
```

### Paying Household Debt

If HH1 has balance `-150`, they owe 150 cents.

1. HH1 approves the PPA contract to spend stablecoin.
2. HH1 calls `settleOwnDebt(1_500_000)`, or another account calls `settleDebt(HH1, 1_500_000)`.
3. The contract converts stablecoin to internal credits: `1_500_000 / 10,000 = 150`.
4. HH1 balance moves toward zero.
5. Stablecoins remain in the contract as liquidity for creditors.
6. `settledBalance` decreases by the settled internal amount.

Anyone can pay anyone else's debt.

### Claiming Member Credit

If Investor 1 has balance `+250`, they can claim 250 cents.

1. Investor 1 calls `claimCredit(250)`.
2. The contract checks it has at least `250 * 10,000` stablecoin base units.
3. Investor 1 balance decreases toward zero.
4. The contract transfers stablecoin to Investor 1.
5. `settledBalance` increases by the claimed internal amount.

A whitelisted account can call `claimCreditFor` for another beneficiary.

### Grid Settlement

The grid is represented by `gridBalance`, not by a normal member record.

If `gridBalance < 0`, the community owes the grid. Anyone can call `settleGridDebt` and pay stablecoin into the contract. `gridBalance` moves toward zero.

If `gridBalance > 0`, the grid owes the community. The grid operator or a whitelisted account can call `claimGridCredit(beneficiary, amount)`. Stablecoin moves out of the contract to the beneficiary, and `gridBalance` moves toward zero.

## VPP Fair-Split Algorithm

The VPP lives in `vpp/`. It is off-chain TypeScript, not Solidity.

| File | Purpose |
|---|---|
| `vpp/types.ts` | Shared TypeScript types and unit conventions |
| `vpp/fair-split.ts` | Pure allocation algorithm |
| `vpp/build-readings.ts` | Converts algorithm output to contract readings |
| `vpp/on-chain-reader.ts` | Reads source/member/ownership state from the deployed PPA |
| `vpp/run-interval.ts` | Parses interval rows and produces readings |
| `vpp/fair-split.test.ts` | Unit tests for allocation scenarios |

The VPP input for one interval is:

- Active members.
- Household consumption in Wh.
- Source production in Wh.
- Source prices.
- Source ownership basis points.
- Grid import/export prices.

The algorithm has three passes.

### Pass 1 - Ownership Allocation

For each member and source, the VPP calculates the member's production share:

```text
shareWh = floor(sourceProductionWh * ownershipBps / 10,000)
```

The member consumes their own share first, sorted by source price from cheapest to most expensive. Any unused share becomes surplus for that source.

### Pass 2 - Surplus Redistribution

If a source has unused energy and some members still have demand, the VPP redistributes the surplus. Redistribution is weighted by ownership basis points for that source.

If no deficit member owns the surplus source, the algorithm falls back to another source's ownership weights so surplus can still be allocated fairly.

### Pass 3 - Grid Import

Any remaining unmet household demand becomes grid import.

### Export

Any production that remains unused after redistribution is exported to the grid. The VPP creates export readings using the special export device ID `9999`.

### Invariants

The VPP checks:

```text
total consumption = local energy used + grid import
total production = local energy used + export
```

If either invariant fails, the VPP throws before contract submission.

## Interval Data Feed and RDS Loop

The AWS RDS loop reads from `accounting.interval_readings`.

Expected row shape:

```ts
type IntervalReading = {
  interval_start: string;
  meter_id: number;
  community_id: number;
  energy_wh: number;
  direction: 'consumption' | 'production' | 'import';
};
```

The current demo expects:

| Direction | Meter IDs | Meaning |
|---|---|---|
| `consumption` | `1`-`5` | Household consumption meters |
| `production` | `9001`, `9002`, `9003` | Solar, Battery 1, Battery 2 integration meters |
| `import` | optional | Informational only; VPP computes import as residual deficit |

`energy-ppav2-rds-loop.ts` maps production meters to source IDs:

| Production meter | Source |
|---:|---|
| `9001` | Solar park |
| `9002` | Battery 1 |
| `9003` | Battery 2 |

The loop:

1. Loads `energy-ppav2-demo-state.json`.
2. Connects to RDS using `ENERGY_RDS_*` environment variables.
3. Finds unprocessed interval buckets.
4. Reads on-chain source/member/ownership config.
5. Runs `runIntervalWithConfig`.
6. Converts Wh to kWh with `QUANTITY_SCALE = 1000`.
7. Runs `consumeEnergy.staticCall`.
8. Sends `consumeEnergy`.
9. Writes a local checkpoint after successful processing.

By default, if no checkpoint exists, the loop starts at the latest interval and does not replay history. Set `ENERGY_RDS_CATCH_UP=1` to process all existing intervals from oldest.

## Demo Scripts

All commands below are run from `packages/storage-evm`.

### Deploy a Community

```bash
ENERGY_DEMO_COMMAND=deploy npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-mainnet-demo.ts --network base-mainnet
```

This deploys or reuses the factory, deploys the community, and writes `energy-ppav2-demo-state.json`.

Relevant environment variables:

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` | Admin/deployer key used by Hardhat |
| `ENERGY_PPAV2_FACTORY` | Reuse an existing factory |
| `DEPLOY_FACTORY=1` | Deploy a new factory if no factory address is provided |
| `REGULAR_SPACE_TOKEN_IMPL` | Optional existing RegularSpaceToken implementation |
| `ENERGY_DEMO_STABLECOIN` | Override stablecoin address |
| `ENERGY_TEST_MNEMONIC` | Derive deterministic demo household/investor addresses |
| `ENERGY_ACTOR_PRIVATE_KEYS` | Provide demo actor private keys |
| `ENERGY_PPAV2_STATE_FILE` | Override state file path |

### Run One Random Legacy Demo Interval

```bash
ENERGY_DEMO_COMMAND=once npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-mainnet-demo.ts --network base-mainnet
```

This script has a simpler built-in allocation planner. It is useful for a quick on-chain smoke test, but `energy-ppav2-vpp-loop.ts` is the more accurate VPP demonstration.

### Run One VPP Interval

```bash
ENERGY_DEMO_COMMAND=once npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
```

This generates random interval data, runs the fair-split algorithm with detailed trace logging, builds `ConsumptionReading[]`, and submits it on-chain.

### Run the VPP Loop

```bash
ENERGY_DEMO_COMMAND=loop ENERGY_DEMO_LOOP_MS=45000 npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
```

### Run the AWS RDS Ingestion Loop

```bash
ENERGY_DEMO_COMMAND=loop npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts --network base-mainnet
```

Required/common environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `ENERGY_RDS_HOST` | required | PostgreSQL host |
| `ENERGY_RDS_PORT` | `5432` | PostgreSQL port |
| `ENERGY_RDS_DATABASE` | required | Database name |
| `ENERGY_RDS_USER` | required | Database user |
| `ENERGY_RDS_PASSWORD` | required | Database password |
| `ENERGY_RDS_SSL` | `1` | Use SSL unless set to `0` |
| `ENERGY_RDS_COMMUNITY_ID` | state file community ID | Community filter |
| `ENERGY_RDS_POLL_MS` | `900000` | Poll interval |
| `ENERGY_RDS_CATCH_UP` | `0` | Process old intervals from oldest |
| `ENERGY_RDS_CHECKPOINT_FILE` | script-local JSON | Local checkpoint path |

### Reset Demo Accounting

```bash
ENERGY_DEMO_COMMAND=reset npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
```

This calls `emergencyReset()`. It clears accounting balances but does not move stablecoins.

## End-to-End Example

Suppose a 15-minute interval has:

```text
HH1 consumption:      3 kWh
HH2 consumption:      2 kWh
Solar production:     4 kWh
Battery 1 production: 1 kWh
Battery 2 production: 0 kWh
```

The VPP:

1. Reads source ownership and prices.
2. Allocates local production to owners first.
3. Redistributes unused shares to households with remaining demand.
4. Computes any grid import or export.
5. Builds readings such as:

```text
HH1 device 1 consumes 2 kWh from solar at 10 ct/kWh
HH1 device 1 consumes 1 kWh from battery 1 at 15 ct/kWh
HH2 device 2 consumes 2 kWh from solar at 10 ct/kWh
```

The contract:

1. Debits HH1 by `2*10 + 1*15 = 35` cents.
2. Debits HH2 by `2*10 = 20` cents.
3. Accumulates `40` cents solar revenue and `15` cents battery revenue.
4. Takes fees from each source revenue.
5. Credits source token holders pro-rata.
6. Verifies the zero-sum invariant.

No stablecoin moves during `consumeEnergy`. Stablecoin only moves later when users settle debts or claim credits.

## Access Control and Operational Safety

Important permissions:

| Permission | Who has it | Why it matters |
|---|---|---|
| Contract owner | Admin | UUPS upgrades, whitelist updates, fee recipient/rate config, grid operator |
| Whitelisted account | Backend/admin | Source registration, member management, `consumeEnergy`, admin claims, emergency reset |
| Grid operator | Configured grid operator | Can claim positive grid credit |
| Energy token authorized account | PPA proxy | Can mint/burn positive credit token balances |

Operational checks before submitting intervals:

1. Signer is whitelisted on the PPA.
2. State file chain ID matches the selected Hardhat network.
3. RDS community ID matches the intended community.
4. Production meter IDs map to the correct source IDs.
5. Consumption meter IDs are registered on-chain.
6. `consumeEnergy.staticCall` passes before sending the transaction.
7. `verifyZeroSum()` remains true after submission.

## Testing

Run the VPP unit tests:

```bash
npx tsx --test vpp/fair-split.test.ts
```

Run the PPA functional tests:

```bash
npx hardhat test test/EnergyPPAv2Functional.test.ts
```

Run gas benchmarks:

```bash
npx hardhat test test/EnergyPPAv2Gas.test.ts
```

The functional tests cover deployment, source registration, members, consumption, fee distribution, grid accounting, stablecoin settlement, access control, and zero-sum verification.

## Current Limitations and Notes

- `EnergyPPAv2` trusts the backend for final `pricePerKwh`. Source base prices are stored as transparent references but are not enforced by the contract.
- The VPP is the allocation authority. The contract validates accounting consistency, not physical meter truth.
- The current RDS loop treats `import` rows as informational and computes import from remaining household deficit.
- Export rows are generated by the backend using device ID `9999`; external feeds should not submit household readings for that device.
- Stablecoin claims require contract liquidity. Debtors or grid debt payers must settle before creditors can withdraw.
- `emergencyReset()` is for testing/demo recovery. It clears internal accounting but does not transfer stablecoins.
- Older scripts and tests use different device IDs. For the current Base demo, use household meters `1`-`5`, export device `9999`, and production integration meters `9001`-`9003`.

## Quick Reference

| Concept | Where to look |
|---|---|
| Main contract | `contracts/EnergyPPAv2.sol` |
| Factory deployment | `contracts/EnergyPPAv2Factory.sol` |
| Positive credit token | `contracts/EnergyToken.sol` |
| Source ownership token | `contracts/RegularSpaceToken.sol` |
| VPP algorithm | `vpp/fair-split.ts` |
| Contract reading builder | `vpp/build-readings.ts` |
| RDS ingestion loop | `scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts` |
| VPP demo loop | `scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts` |
| Deployment state | `scripts/base-mainnet-contracts-scripts/energy-ppav2-demo-state.json` |
| UI values | `README-energy-demo-enable-energy-community-ui.md` |
| Data feed spec | `ENERGY_INTERVAL_DATA_FEED.md` |
