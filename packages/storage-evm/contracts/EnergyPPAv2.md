# EnergyPPAv2 — Contract Documentation

## What Is This?

EnergyPPAv2 is a smart contract that handles **energy billing and revenue sharing** for a community. Think of it as an on-chain ledger that:

1. **Charges consumers** for the energy they use.
2. **Splits revenue** from each energy source (solar park, battery, etc.) to the people who own shares in that source.
3. **Lets members claim** their positive balance as stablecoins, or settle debt by paying stablecoins.

Each energy source has its own ERC-20 ownership token, typically a **`RegularSpaceToken`** UUPS proxy (the same contract family used for Hypha space tokens). If you hold 30% of a source's token supply, you get 30% of that source's revenue after fees. The PPA contract only requires standard `IERC20` (`balanceOf` / `totalSupply`).

A **factory contract** (`EnergyPPAv2Factory`) can deploy a fully configured community in a single transaction.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Source** | An energy source like a solar park or battery. Identified by a `bytes32` ID. |
| **Ownership token (e.g. RegularSpaceToken)** | An ERC-20 (usually a `RegularSpaceToken` proxy) representing ownership of a specific source. Token balance = revenue share. |
| **Member** | A community participant — either a consumer (has devices/meters) or a pure investor (no devices, just owns source tokens). |
| **Device** | A smart meter identified by a numeric ID, linked to a member. |
| **Import** | Energy bought from the external grid (not from a local source). |
| **Export** | Energy sold back to the grid from a local source. |
| **Energy Credit Balance** | A member's running balance. Positive = credit (claimable as stablecoins), negative = debt (payable in stablecoins). |
| **Fees** | Community fee + aggregator fee, taken as a percentage (basis points) from each source's revenue before distributing to token holders. |
| **Zero-Sum** | The contract enforces that all credits and debits always net to zero. |
| **Stablecoin Pool** | Stablecoins accumulate in the contract when members settle debts. Members with positive balances can claim from this pool. |

---

## Initialization

### `initialize(initialOwner, energyToken, stablecoin, paymentRecipient)`

Sets up the contract for the first time. Called once after deployment.

- `initialOwner` — the admin address (contract owner).
- `energyToken` — address of the EnergyToken ERC-20 used to represent positive balances.
- `stablecoin` — address of the stablecoin ERC-20 used for debt settlement and credit claims.
- `paymentRecipient` — address for legacy payment forwarding (unused in current flow).

---

## Source Registry

### `registerSource(sourceId, sourceType, ownershipToken, basePricePerKwh)`

Registers a new energy source (e.g. "Solar Park A").

- `sourceId` — unique identifier (bytes32).
- `sourceType` — `SOLAR` or `BATTERY`.
- `ownershipToken` — address of the ownership ERC-20 for this source (e.g. `RegularSpaceToken` proxy).
- `basePricePerKwh` — the agreed PPA base price. Stored for transparency but **not enforced** — the backend can adjust the actual price per reading.

**Access:** whitelisted callers only.

### `updateSourceBasePrice(sourceId, newBasePrice)`

Updates the reference base price for a source. Does not affect already-processed readings.

**Access:** whitelisted callers only.

### `deactivateSource(sourceId)`

Marks a source as inactive. Deactivated sources cannot receive new consumption readings.

**Access:** whitelisted callers only.

---

## Core: Energy Consumption

### `consumeEnergy(readings)`

The main function. Processes an array of consumption readings for one time interval and distributes revenue. Works in two phases:

**Phase 1 — Charge consumers:**

For each reading:
- Looks up which member owns the device.
- Charges the member: `quantity × pricePerKwh` is subtracted from their balance.
- If the source is `IMPORT` (grid), the charge goes to `importEnergyCreditBalance`.
- If the source is a local source (solar/battery), the charge is added to that source's revenue pot.
- If the device is the export meter, the reading is treated as an export sale — revenue goes to the source, and `exportEnergyCreditBalance` is debited.

**Phase 2 — Distribute revenue per source:**

For each source that earned revenue:
1. Community fee is taken (% of total revenue) → credited to `communityAddress`.
2. Aggregator fee is taken (% of total revenue) → credited to `aggregatorAddress`.
3. Remaining revenue is split proportionally among all members who hold that source's ownership token.
4. The last token holder absorbs any rounding dust.

**Access:** whitelisted callers only. Enforces zero-sum invariant.

---

## Member Management

### `addMember(memberAddress, deviceIds, metadataHash)`

Adds a new community member.

- `memberAddress` — their wallet address.
- `deviceIds` — array of smart meter IDs linked to this member. Pass an empty array for pure investors.
- `metadataHash` — off-chain metadata reference (e.g. IPFS hash).

**Access:** whitelisted callers only.

### `removeMember(memberAddress)`

Removes a member from the community. Unlinks all their devices, deletes their balance, and burns any energy tokens they hold.

**Access:** whitelisted callers only.

---

## Debt Settlement

### `settleDebt(debtor, stablecoinAmount)`

Allows anyone to pay off a member's debt using stablecoins. The stablecoin is transferred from `msg.sender` into the contract (building the liquidity pool). The debtor's negative balance is reduced accordingly.

The conversion rate is `1 internal unit = 10,000 stablecoin units` (to handle decimal precision).

**Access:** anyone (uses reentrancy guard).

### `settleOwnDebt(stablecoinAmount)`

Convenience function — same as `settleDebt` but the caller pays their own debt.

**Access:** anyone (uses reentrancy guard).

---

## Credit Claiming

### `claimCredit(internalAmount)`

Withdraw a positive energy credit balance as stablecoins. The contract must hold enough stablecoin liquidity (funded by debt settlements).

- `internalAmount` — amount to claim in internal units. If this exceeds the available credit, only the available amount is claimed.
- Conversion: `1 internal unit = 10,000 stablecoin units`.

**Access:** anyone with a positive balance (uses reentrancy guard).

### `claimCreditFor(beneficiary, internalAmount)`

Same as `claimCredit`, but a whitelisted caller can trigger the payout for any member. Stablecoins are sent to the beneficiary.

**Access:** whitelisted callers only (uses reentrancy guard).

---

## Admin Functions

### `updateWhitelist(account, isWhitelisted)`

Grants or revokes whitelist access for an address. Whitelisted addresses can call core functions like `consumeEnergy`, `addMember`, `registerSource`, etc.

**Access:** owner only.

### `setEnergyToken(tokenAddress)`

Changes the EnergyToken contract address.

**Access:** whitelisted callers only.

### `setStablecoin(tokenAddress)`

Changes the stablecoin contract address used for settlement and claims.

**Access:** whitelisted callers only.

### `setExportDeviceId(deviceId)`

Sets which device ID represents the community's export meter (energy sold to the grid).

**Access:** whitelisted callers only.

### `setCommunityAddress(addr)`

Sets the address that receives community fees.

**Access:** owner only.

### `setAggregatorAddress(addr)`

Sets the address that receives aggregator fees.

**Access:** owner only.

### `setCommunityFeeBps(bps)`

Sets the community fee as basis points (e.g. 500 = 5%). Combined community + aggregator fees cannot exceed 100%.

**Access:** owner only.

### `setAggregatorFeeBps(bps)`

Sets the aggregator fee as basis points. Combined community + aggregator fees cannot exceed 100%.

**Access:** owner only.

### `setPaymentRecipient(recipient)`

Sets the payment recipient address (legacy).

**Access:** owner only.

### `emergencyReset()`

Resets all balances to zero — all members, community, aggregator, import, export, and settled balances. Use only in emergencies.

**Access:** whitelisted callers only.

---

## View Functions (Read-Only)

These functions don't change state — they just return data.

| Function | Returns |
|---|---|
| `getSourceIds()` | Array of all registered source IDs. |
| `getSource(sourceId)` | Full details of a source (type, token address, base price, active status). |
| `getSourceOwnershipBps(sourceId, member)` | A member's ownership of a source in basis points (e.g. 3000 = 30%). |
| `getAllSourceOwnerships(member)` | For every active source, returns the member's ownership in basis points. |
| `getMember(memberAddress)` | Member details (address, device IDs, active status, metadata hash). |
| `getMemberAddresses()` | Array of all member addresses. |
| `getEnergyCreditBalance(account)` | A member's current balance (positive = credit, negative = debt). |
| `getTokenBalance(account)` | A member's EnergyToken balance (the token representation of positive credit). |
| `getDebtInStablecoin(debtor)` | A member's debt converted to stablecoin units (internal debt × 10,000). |
| `getCreditInStablecoin(account)` | A member's claimable credit in stablecoin units (internal credit × 10,000). |
| `getContractStablecoinBalance()` | How many stablecoins are held in the contract (available for claims). |
| `verifyZeroSum()` | Returns `(true, 0)` if the system is balanced, or `(false, drift)` if not. |
| `getDeviceOwner(deviceId)` | The member address that owns a given device/meter. |
| `getImportEnergyCreditBalance()` | Total accumulated grid import charges. |
| `getExportEnergyCreditBalance()` | Total accumulated grid export balance. |
| `getSettledBalance()` | Total amount settled/claimed via stablecoin (negative = debt paid in, positive = credit paid out). |
| `getEnergyTokenAddress()` | Address of the EnergyToken contract. |
| `isAddressWhitelisted(account)` | Whether an address is on the whitelist. |
| `getCommunityFeeBps()` | Current community fee in basis points. |
| `getAggregatorFeeBps()` | Current aggregator fee in basis points. |

---

## Access Control Summary

| Role | Can Do |
|---|---|
| **Owner** | Manage whitelist, set fee addresses, set fee percentages, set payment recipient, authorize upgrades. |
| **Whitelisted** | Register/deactivate sources, add/remove members, process consumption, set tokens, emergency reset, `claimCreditFor`. |
| **Anyone** | Settle debt (own or others'), claim own credit, read all view functions. |

---

## Money Flow

```
Consumers pay energy bills
        │
        ▼
┌──────────────────────────────┐
│   EnergyPPAv2 Contract       │
│                              │
│  consumer balance goes DOWN  │  (negative = debt)
│  source owners balance UP    │  (positive = credit)
│  community/aggregator UP     │  (fee credit)
│                              │
│  ┌────────────────────────┐  │
│  │  Stablecoin Pool       │  │
│  │  (USDC held in contract)│  │
│  └──────▲─────────┬───────┘  │
│         │         │          │
│   settleDebt  claimCredit    │
│   (pays in)   (pays out)     │
└──────────────────────────────┘
```

---

# EnergyPPAv2Factory

## What Is This?

A factory that deploys a fully configured EnergyPPAv2 community in **one transaction**. It creates:

1. An **EnergyToken** for the community.
2. A **RegularSpaceToken** UUPS proxy per energy source (using the shared Hypha implementation), with the factory as `executor` initially so it can mint the configured distribution to holders in the same tx.
3. A **UUPS proxy** pointing at a shared EnergyPPAv2 implementation.
4. Registers all sources, adds all members, configures fees, and hands PPA ownership to the admin.

**Constructor:** `EnergyPPAv2Factory(ppaImplementation, regularSpaceTokenImplementation)` — both must be non-zero (deploy bare implementations once, reuse for every community).

### `deployCommunity(params)`

Deploys everything and returns `(communityId, proxyAddress)`.

**Parameters** (passed as a single `CommunityParams` struct):

| Field | Type | Description |
|---|---|---|
| `admin` | address | The community admin (receives ownership of all contracts). |
| `stablecoin` | address | Stablecoin address for settlement/claims. |
| `communityAddress` | address | Address that receives community fees. |
| `aggregatorAddress` | address | Address that receives aggregator fees. |
| `communityFeeBps` | uint16 | Community fee in basis points. |
| `aggregatorFeeBps` | uint16 | Aggregator fee in basis points. |
| `exportDeviceId` | uint256 | Device ID for the community export meter. |
| `energyTokenName` | string | Name of the EnergyToken (e.g. "Community Energy"). |
| `energyTokenSymbol` | string | Symbol of the EnergyToken (e.g. "CET"). |
| `sources` | SourceConfig[] | Array of energy sources to create (see below). |
| `members` | MemberConfig[] | Array of members to add (see below). |

**SourceConfig:**

| Field | Type | Description |
|---|---|---|
| `sourceId` | bytes32 | Unique identifier for the source. |
| `sourceType` | SourceType | `SOLAR` (0) or `BATTERY` (1). |
| `tokenName` | string | Name of the ownership token (e.g. "Solar Park Alpha"). |
| `tokenSymbol` | string | Symbol (e.g. "SOLAR-A"). |
| `basePricePerKwh` | uint256 | Reference PPA price. |
| `holders` | address[] | Addresses that receive ownership tokens. |
| `holderAmounts` | uint256[] | Token amounts per holder (must match `holders` length). |

**MemberConfig:**

| Field | Type | Description |
|---|---|---|
| `memberAddress` | address | Member's wallet. |
| `deviceIds` | uint256[] | Smart meter IDs (empty for investors). |
| `metadataHash` | bytes32 | Off-chain metadata reference. |

### Other Factory Functions

| Function | Description |
|---|---|
| `setImplementation(newImpl)` | Update the shared EnergyPPAv2 implementation (owner only). |
| `getCommunityCount()` | How many communities have been deployed. |
| `communities(id)` | Get the record for a community (proxy, energyToken, admin, timestamp). |
| `getAdminCommunities(admin)` | Get all community IDs for an admin. |

---

## Gas Benchmarks

Measured on Hardhat local network with optimizer (200 runs, viaIR).

### Per-Function Gas

| Function | Gas |
|---|---|
| `registerSource` | ~127k |
| `addMember` — 1 device | ~173k |
| `addMember` — investor (0 devices) | ~108k |
| `removeMember` | ~68k |
| `settleOwnDebt` | ~99k |
| `claimCredit` | ~92k |
| `updateWhitelist` | ~53k |
| `setCommunityFeeBps` | ~34k |
| `emergencyReset` (5 members) | ~108k |
| `deployCommunity` (2 sources, 4 members) | ~3.3M |

### consumeEnergy — Scale Tests

Base block gas limit is **30,000,000**.

| Members | Sources | Readings | Gas | % of 30M |
|---|---|---|---|---|
| 5 | 2 | 1 | 384k | 1.3% |
| 5 | 2 | 4 | 418k | 1.4% |
| 5 | 2 | 8 | 707k | 2.4% |
| 10 | 2 | 20 | 1.29M | 4.3% |
| 20 | 2 | 40 | 2.32M | 7.7% |
| 50 | 2 | 100 | 5.40M | 18.0% |
| 50 | 4 | 200 | 10.33M | 34.4% |
| 100 | 2 | 200 | 10.55M | 35.2% |
| 100 | 4 | 400 | 20.22M | 67.4% |
| 150 | 2 | 300 | 15.69M | 52.3% |
| 200 | 2 | 400 | 20.84M | 69.5% |
| 100 | 2 | 100 (sparse) | 8.32M | 27.7% |
| 100 | 1+import | 100 (50+50) | 5.75M | 19.2% |

### What Drives Gas Cost

Gas is dominated by three factors:

1. **Phase 1** — charging consumers: ~3–5k gas per reading
2. **Phase 2** — revenue distribution: ~50–80k gas per (source × member)
3. **Zero-sum check**: ~10–20k gas per member

Phase 2 is the biggest cost because it iterates over all members for each source
that earned revenue.

### Batching for Large Communities

`consumeEnergy` can be called **multiple times per interval**. For communities
that exceed the gas limit in a single call, the backend simply splits the
readings into batches:

```
Interval T (e.g. every 15 minutes)
  ├─ consumeEnergy(readings[0..99])     ← batch 1
  ├─ consumeEnergy(readings[100..199])  ← batch 2
  └─ consumeEnergy(readings[200..299])  ← batch 3
```

Each call independently:
- Charges the consumers in that batch.
- Distributes revenue from that batch to token holders.
- Verifies zero-sum for that batch.

Balances accumulate across batches. There is no requirement to submit all
readings in one transaction.

**Practical guidance:**

| Community Size | Sources | Recommended Batch Size |
|---|---|---|
| ≤50 members | 2 | All in one call (~5.4M gas) |
| ≤100 members | 2 | All in one call (~10.5M gas) |
| ≤200 members | 2 | All in one call (~20.8M gas) |
| 200–400 members | 2 | 2 batches |
| ≤100 members | 4 | All in one call (~20.2M gas) |
| 200+ members | 4+ | Split into batches of ~100 members per source |

Import-only readings are cheaper (no Phase 2 distribution), so mixed
local+import batches use less gas than all-local batches.
