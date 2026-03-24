# NanoPPA — Automated Energy Agreements

## What is it?

A nanoPPA is a tiny, automatic energy contract between two people:

- **Producer** — someone with solar panels (or another renewable source)
- **Consumer** — someone who uses that energy

Every 15 minutes, the contract checks how much energy was produced and consumed, calculates the price, and updates the balances inside the existing energy distribution system. No humans involved.

## How the pieces fit together

```
┌─────────────────────────────────────────────────────────────────────┐
│                        The full settlement flow                     │
│                                                                     │
│  ┌──────────────┐     ┌──────────────────┐                         │
│  │ Smart Meters  │────►│  Oracle           │                        │
│  │ (P4/P1/own)   │     │  (posts readings  │                        │
│  └──────────────┘     │   every 15 min)   │                        │
│                        └────────┬─────────┘                         │
│                                 │                                   │
│                                 ▼                                   │
│                        ┌──────────────────┐                         │
│                        │  NanoPPAFactory   │  ← agreement + rules   │
│                        │  • allocate kWh   │                        │
│                        │  • compute price  │                        │
│                        └────────┬─────────┘                         │
│                                 │                                   │
│              recordBilateralSettlement(producer, consumer, €, fee)   │
│                                 │                                   │
│                                 ▼                                   │
│                        ┌──────────────────┐                         │
│                        │  EnergyDistrib.   │  ← accounting engine   │
│                        │  • credit producer│                        │
│                        │  • debit consumer │                        │
│                        │  • fee → community│                        │
│                        └────────┬─────────┘                         │
│                                 │                                   │
│                     consumer has negative balance (debt)             │
│                                 │                                   │
│                                 ▼                                   │
│                        ┌──────────────────┐                         │
│                        │  EnergySettlement │  ← actual money         │
│                        │  • consumer pays  │                        │
│                        │    EURC/EURe      │                        │
│                        │  • debt → zero    │                        │
│                        └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Three contracts, three jobs

| Contract | What it does |
|----------|-------------|
| **NanoPPAFactory** | Stores bilateral agreements. Computes how much energy was allocated and at what price. Tells EnergyDistribution to update balances. |
| **EnergyDistributionImplementation** | The accounting engine. Tracks who owes what via cash credit balances (positive = credit, negative = debt). Enforces zero-sum: every euro credited to a producer is debited from a consumer. |
| **EnergySettlement** | Converts debt to real money. Consumer sends EURC stablecoin, their negative balance moves toward zero. |

No stablecoin flows directly through the nanoPPA. It only computes; the existing system handles the money.

## Step by step

**1. Create an agreement**

Someone calls `NanoPPAFactory.createAgreement()` with:
- Who the producer and consumer are (wallet addresses)
- What country they're in (for distance rules)
- Their GPS coordinates (checked against national limits)
- What percentage of energy the consumer gets (sharing key)
- Product type (delivery, flexibility, etc.)

The contract checks that the producer and consumer are close enough under their country's rules and creates the agreement.

**2. Every 15 minutes — settle**

A trusted oracle reads the smart meters and calls `settleInterval()` with:
- How many kWh the producer generated
- How many kWh the consumer used
- The reference price

The nanoPPA then:
1. **Allocates** — figures out how much energy goes to this consumer
2. **Prices** — multiplies allocated kWh by the reference price (always calculated *after the fact*)
3. **Records** — calls `EnergyDistribution.recordBilateralSettlement()`:
   - Producer's cash credit balance goes **up** (they earned money)
   - Consumer's cash credit balance goes **down** (they owe money)
   - Aggregator fee goes to the **community balance**

**3. Consumer settles their debt**

When the consumer's balance is negative, they can pay it off using the existing `EnergySettlement` contract — same as any other energy debt in the system. They send EURC/EURe stablecoin, and their balance moves back toward zero.

**4. If meter data is missing**

The oracle calls `settleIntervalEstimated()` instead. No balances change. If data is missing 3 times in a row, a dispute is automatically flagged.

**5. If there's a disagreement**

Either party can call `raiseDispute()`. The intended resolution follows cooperative principles:
1. **Auto** — contract uses estimated data (0–48h)
2. **Panel** — 3-person arbitration: 1 chosen by consumer, 1 by producer, 1 independent (48h–30 days)
3. **Legal** — national courts as last resort

**6. Lifecycle**

Any party can **suspend**, **resume**, or **terminate** the agreement at any time.

## How `recordBilateralSettlement` works

This is the bridge function added to `EnergyDistributionImplementation`:

```
recordBilateralSettlement(producer, consumer, eurAmount, aggregatorFee)

  producer balance   += (eurAmount − aggregatorFee)     ← credit
  consumer balance   −= eurAmount                       ← debit
  community balance  += aggregatorFee                   ← fee

  Net change = +(eurAmount − fee) + (−eurAmount) + fee = 0   ← zero-sum ✓
```

Both the producer and consumer must be registered members of the EnergyDistribution contract. The NanoPPAFactory must be whitelisted on EnergyDistribution to call this function.

## Sharing key types

| Type | How it works | Best for |
|------|-------------|----------|
| **Static** | Fixed percentage (e.g. "you get 30%") | Simple cooperatives |
| **Dynamic** | Proportional to real-time demand | Fair splitting |
| **Priority** | Rules-based ordering (e.g. vulnerable households first) | Social objectives |

## Product types

Each agreement has exactly one product type:

| Type | What it is |
|------|-----------|
| **Energy Delivery** | Standard: producer delivers kWh to consumer |
| **Energy Flexibility** | Consumer adjusts usage on grid signals (for congestion management) |
| **Energy Reduction** | ESCO-style: savings vs. a baseline are split between parties |
| **Granular GOO** | Renewable energy certificate, timestamped to the 15-min window |
| **Avoided Carbon Credits** | CO₂ avoided vs. grid emission factor |

## What lives on-chain vs. off-chain

| On-chain (in the contract) | Off-chain (IPFS, linked by hash) |
|---|---|
| Wallet addresses of all parties | Full legal names, meter IDs (EAN/EIC) |
| Country code, distance validation result | GPS coordinates, entity types |
| Sharing key type & percentage | Price formula weights |
| Aggregator fee (basis points) | Legal jurisdiction, arbitration seat |
| Running totals (kWh settled, EUR settled) | REC purpose statement |
| Agreement status | Full contract terms PDF |

## Contract architecture

```
contracts/
├── NanoPPAFactory.sol                   ← agreement + settlement logic (UUPS upgradeable)
├── EnergyDistributionImplementation.sol ← accounting engine (existing, now with bilateral bridge)
├── EnergySettlement.sol                 ← EURC debt payment (existing, unchanged)
├── EnergyToken.sol                      ← ERC-20 for positive balances (existing, unchanged)
├── interfaces/
│   ├── INanoPPA.sol                     ← nanoPPA types, events, function signatures
│   ├── IDistanceOracle.sol              ← geographic validation interface
│   └── IEnergyDistribution.sol          ← now includes recordBilateralSettlement
└── storage/
    ├── NanoPPAStorage.sol               ← nanoPPA state variables
    └── EnergyDistributionStorage.sol    ← existing storage
```

## Deployment & wiring

1. Deploy `NanoPPAFactory` via UUPS proxy
2. Call `NanoPPAFactory.initialize(owner, energyDistributionAddress, distanceOracleAddress, defaultAggregator)`
3. Whitelist the NanoPPAFactory address on EnergyDistribution: `energyDistribution.updateWhitelist(nanoPPAFactoryAddress, true)`
4. Whitelist the oracle address on NanoPPAFactory: `nanoPPAFactory.updateOracleWhitelist(oracleAddress, true)`

## Country distance rules

| Country | Rule | Notes |
|---------|------|-------|
| Spain | ≤ 5 km (general); ≤ 500 m (same LV substation) | Since RDL 7/2025 |
| Portugal | ≤ 2 km (LV); ≤ 4 km (MV); ≤ 10 km (HV); ≤ 20 km (EHV) | Voltage-level based |
| Netherlands | No limit — nationwide | New Energy Act 2026 |
| Norway | Same property or same C&I zone | No km number in law |

These rules are enforced by the `IDistanceOracle` at agreement creation time.

## Key numbers

| Value | Precision | Example |
|-------|-----------|---------|
| kWh amounts | ×1e4 (4 decimals) | `15000` = 1.5 kWh |
| EUR amounts | same unit scale as EnergyDistribution internal credits | matches existing system |
| Sharing key | basis points (10000 = 100%) | `3000` = 30% |
| Aggregator fee | basis points | `100` = 1% |
| Settlement interval | 15 minutes (EU standard since Jan 2021) | |
