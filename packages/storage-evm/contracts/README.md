# Hypha Energy Community

## Overview

An Energy Community in Hypha is a collectively governed solar energy system where members share ownership of energy infrastructure and its financial accounting is managed on-chain. The system tracks energy flows (local production, battery storage, grid import/export) and settles the resulting credits and debts using a zero-sum accounting model backed by ERC-20 tokens and stablecoin settlement.

## Token Model

In order to function, each energy community needs two types of tokens:

### 1. Energy System Ownership Token (ESOT)

Represents ownership of the community's physical infrastructure — treasury, solar panels, batteries, and other equipment. Holding ESOT gives the right to a proportional share of the energy value produced by the system.

### 2. Energy Credit Token (ECT)

An ERC-20 token (`EnergyToken.sol`) that represents positive cash credit balances within the energy distribution system. ECT tokens can be converted to stablecoins (USDC/EURC) through the settlement process. The token uses 6 decimals to match stablecoin precision.

ESOT holders who do not consume their full energy allocation accumulate ECT, which they can redeem for stablecoins. ESOT holders who consume energy pay at the local production cost. Non-owners pay market rate and do not accumulate ECT.

## Participant Types

There are three types of participants in an energy community. The flow diagrams below show what happens during a single distribution and consumption cycle.

### 1. Investor

Holds ESOT but does not consume energy. Their share of locally produced energy enters the collective pool and is purchased by other consumers. The investor accumulates ECT.

```
Distribution                          Consumption
───────────                           ───────────

  Solar Production                    Consumer buys investor's
       │                              allocation from the pool
       ▼                                     │
┌──────────────┐                             ▼
│ Collective   │                    ┌──────────────────┐
│ Pool         │                    │ Consumer pays     │
│ [Investor's  │ ──────────────▶    │ production price  │
│  allocation] │                    └────────┬─────────┘
└──────────────┘                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ Investor receives │
                                   │ ECT (credit)      │
                                   └────────┬─────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │ Convert ECT ──▶   │
                                   │ USDC / EURC       │
                                   └──────────────────┘
```

### 2. Internal Consumer (no ESOT)

Does not hold ESOT and has no ownership percentage. Receives no allocation during distribution. All consumption is purchased from the collective pool — first from any remaining owner tokens at production price, then from grid imports at import price (typically more expensive). Always ends with a negative balance (debt) that must be settled via EURC.

```
Distribution                          Consumption
───────────                           ───────────

  No allocation                       Consumer needs energy
  (0% ownership)                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Buy from pool     │
                                    │ (cheapest first)  │
                                    │                   │
                                    │ 1. Owner tokens   │
                                    │    @ local price  │
                                    │ 2. Import pool    │
                                    │    @ import price │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Consumer balance  │
                                    │ goes NEGATIVE     │
                                    │ (debt)            │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Must settle debt  │
                                    │ with EURC         │
                                    └──────────────────┘
```

### 3. Member (holds ESOT and consumes)

Holds ESOT and also consumes energy. During distribution, receives a proportional allocation. During consumption, self-consumes own allocation first at local production cost — that payment goes to the community treasury (which they partially own). If they consume less than allocated, the surplus is sold to others and the member accumulates ECT. If they consume more, they buy the remainder from the pool at whatever price is available.

```
Distribution                          Consumption
───────────                           ───────────

  Solar Production                    Member consumes energy
       │                                     │
       ▼                                     ▼
┌──────────────┐                    ┌──────────────────┐
│ Collective   │                    │ PASS 1: Self-     │
│ Pool         │                    │ consume own       │
│ [Member's    │ ──────────────▶    │ tokens @ local    │
│  allocation] │                    │ production price  │
└──────────────┘                    └────────┬─────────┘
                                             │
                              ┌──────────────┴──────────────┐
                              │                             │
                     Under-consumed                Over-consumed
                              │                             │
                              ▼                             ▼
                    ┌─────────────────┐          ┌─────────────────┐
                    │ Surplus sold to │          │ PASS 2: Buy     │
                    │ other consumers │          │ from pool       │
                    │       │         │          │ (others/imports)│
                    │       ▼         │          └────────┬────────┘
                    │ Member receives │                   │
                    │ ECT (credit)    │                   ▼
                    └─────────────────┘          ┌─────────────────┐
                                                 │ Balance may go  │
                                                 │ negative (debt) │
                                                 │ → settle w EURC │
                                                 └─────────────────┘
```

## Nano PPAs (Power Purchase Agreements)

A nano PPA is a small-scale Power Purchase Agreement between the energy community and an individual energy recipient. It governs the **physical delivery** of energy — who receives it, at what terms, and from which installation.

### What the agreement covers

- The recipient address (wallet) that will receive energy
- The terms of delivery (price discount, duration, quantity commitments)
- The physical device(s) / meter(s) associated with the recipient

### Relationship to the smart contract

The nano PPA is the off-chain (or on-chain via Hypha Agreements) legal/governance layer. The smart contract is the execution layer:

| Nano PPA (agreement) | Smart contract (execution) |
|---|---|
| Defines who receives energy | `addMember(address, deviceIds, ownershipPercentage)` registers the recipient |
| Defines price terms | Pool prices and self-consumption priority enforce discounted rates for owners |
| Defines duration / commitments | Governance can add/remove recipients via proposals |
| Physical delivery tracking | Backend reads meter data and submits to `distributeEnergyTokens` / `consumeEnergyTokens` |

A nano PPA does **not** affect the distribution of ECT. ECT distribution is determined solely by ESOT ownership percentage. The nano PPA only governs who receives the physical energy and on what terms.

## Governance: Energy System Owners Space

The Energy System Owners Space is the governing body of the community.

The space controls:

- Issuance of ESOT
- Adding and removing energy recipients (members)
- Configuration of battery, export prices, and other system parameters
- Whitelisting backend services for automated energy distribution

### Proposal Types

- **Apply Energy Community Template** — applies the template to the Space, creating all tokens and contracts (see [The Template](#the-template) below).
- **Add Energy Recipient** — register a new member address. Device IDs are optional during setup; if a member has multiple devices, aggregation can happen on the backend before on-chain submission.
- Additional proposal types can be added as the community evolves.

## The Template

After a Space is created in Hypha, there is one template that can be applied to turn it into an energy community. Applying the template creates:

- **ESOT** — Energy System Ownership Token
- **ECT** — Energy Credit Token
- **ECT Distribution Contract** — an instance of `EnergyDistributionImplementation`, deployed per community so each can customize its configuration independently

The template requires the following parameters at setup:

| Parameter | Description |
|---|---|
| Battery price | Cost per unit of energy stored/discharged from the battery |
| Battery max capacity | Maximum energy the battery can hold |
| Export price | Price per kWh when surplus energy is sold to the grid |
| Export device ID | Identifier for the grid export meter |
| Community device ID | Identifier for the community's shared meter |
| Payment recipient address | Address that receives EURC stablecoin payments from debt settlement |
| Backend service address | Off-chain service whitelisted to submit energy distribution and consumption data |
| Energy recipients | List of member wallet addresses that will receive energy from the community |

## Contract Architecture

### EnergyDistributionImplementation

The core contract managing the energy community's accounting. Upgradeable via UUPS proxy.

**Energy Sources** have a `sourceId`, `price`, `quantity`, and an `isImport` flag:

- **Local production** (`isImport = false`) — solar output distributed proportionally to members by ownership percentage. Each member's share enters the collective consumption pool tagged with their address.
- **Grid import** (`isImport = true`) — purchased grid energy enters the pool as community-owned (address zero). Members who consume more than their allocation buy from this pool at cost.
- **Battery discharge** (`sourceId = 999`) — when battery state decreases, the released energy is treated as a production source at the configured battery price.

**Distribution cycle** (`distributeEnergyTokens`):

1. Previous distribution must be fully consumed before a new one can occur.
2. Battery state changes are calculated (charging deducts from local production, discharging adds a source).
3. Local production is split by ownership percentage into the collective consumption pool.
4. Imported energy is added to the community pool.
5. The pool is sorted by price (cheapest first).

**Consumption cycle** (`consumeEnergyTokens`):

1. Exports are processed first — surplus energy sold to the grid at the configured export price. Profit goes to the token owner, production cost goes to the community balance, and revenue is debited from the export balance.
2. Member consumption follows two passes:
   - **Self-consumption** — members consume their own allocated tokens first (payment credited to community balance).
   - **Cross-consumption** — remaining demand is filled from other members' tokens or the import pool, cheapest first. Payments flow to the respective token owners or the import balance.
3. All consumption must be fully satisfied; partial consumption reverts.

**Zero-sum accounting**: Every credit is offset by an equal debit. The system enforces this invariant with the `ensureZeroSum` modifier that checks: `memberBalances + exportBalance + importBalance + settledBalance + communityBalance == 0`.

### EnergySettlement

Handles conversion of negative energy balances (debts) into stablecoin payments.

- Members (or third parties) pay EURC to settle a debtor's negative balance.
- EURC is forwarded to a configurable payment recipient (e.g., the community treasury).
- The debt amount is converted from EURC (6 decimals) to the energy system's internal unit (cents, 2 decimals) at a 1:1 EUR ratio.
- Settlement updates the distribution contract's `settledBalance` to maintain the zero-sum property.

### EnergyToken (ECT)

An ERC-20 with authorized mint/burn access. The distribution contract is the sole authorized minter. Positive cash credit balances are represented as token holdings; negative balances are tracked in a separate mapping. When an authorized contract transfers tokens, auto-minting ensures sufficient supply.

## Balance Model

| Balance | Tracks |
|---|---|
| Member token balance (positive) | Energy credits — convertible to stablecoins |
| Member cash credit (negative) | Energy debt — must be settled via EURC |
| Export balance | Revenue owed to the community from grid export |
| Import balance | Cost owed by the community for grid import |
| Community balance | Accumulated self-consumption payments, routed to treasury |
| Settled balance | External money brought in through debt settlement |

## Key Addresses (Base Mainnet)

| Contract | Address |
|---|---|
| EnergyDistribution (proxy) | `0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95` |
| EnergyToken (ECT) | `0xE7E8DaE0c4541fCDc563B1bD9A6a85d9aB762080` |
