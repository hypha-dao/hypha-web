# How the Energy Community Works

This document is a quick walkthrough of the new energy settlement system for non-technical stakeholders. It needs to be aligned with Zek — if he doesn't mind, let's have a call to go through it.

**Part 1** is a quick technical walkthrough of the data pipeline: how meter readings travel from hardware to databases to the blockchain, and what happens at each step.

**Part 2** is about the algorithm that fairly determines who has to pay what. This is the core of the EMS (Energy Management System) and replaces the previous on-chain settlement logic.

**Why the rearchitecture?** The previous system processed members one by one in a loop. Whoever was processed first in the array got the cheapest energy; whoever was last got stuck with expensive grid imports. Just reordering the array could swing a member's bill by over 100% — same production, same consumption, different outcome depending on array position. The system was also inflexible with pricing: all local energy had a single price, making it hard to differentiate between solar, battery, and other sources that have different real-world costs. The new system solves both problems — fair proportional distribution regardless of ordering, and per-source pricing.

---

## Meet the Community

```
               ┌───────────────────┐
               │   ELECTRICITY     │
               │      GRID         │
               └────────┬──────────┘
                        │
           ┌────────────┼──────────────────────────┐
           │          Shared Wire                   │
           │      (connects everything)             │
           ├──────┬──────┬──────┬──────┬─────┬──────┤
           │      │      │      │      │     │      │
         Alice   Bob   Carol  Dave   Eve   Solar  Battery
                                           Park
```

- **Alice, Bob, Carol, Dave** — four households that consume electricity.
- **Eve** — an investor. She does not live in the community and does not consume any electricity. She earns revenue from her ownership.
- **Solar park** — produces electricity from sunlight for the community.
- **Battery** — stores excess solar energy and releases it later.
- **Grid** — the national electricity network. Used when solar + battery aren't enough.

Each energy source has its own ownership structure — one member might invest in the solar park but not the battery, or vice versa:

| Member | Solar Park | Battery |
|--------|-----------|---------|
| Alice  | 30%       | 25%     |
| Bob    | 30%       | 25%     |
| Carol  | 10%       | —       |
| Dave   | 20%       | 25%     |
| Eve    | 10%       | 25%     |

Your ownership % in a source determines both the share of cheap energy you receive from that source and the share of revenue you earn from it. Carol invested only in the solar park, not the battery — she'll get solar energy at the cheap rate but no battery energy, and she earns solar revenue but no battery revenue.

---

## Part 1 — From Meters to Bills: The Technical Pipeline

Every member, the solar park, the battery, and the grid connection each have a smart meter. Think of a smart meter as a tiny computer strapped to the wire that counts how much electricity flows through it.

Here is what happens, step by step, every 15 minutes.

### Step 1: Meters send readings

Every 10 seconds, each smart meter sends a small message: "Right now, 1.2 kW is flowing through me."

These messages travel over the internet using a lightweight protocol called **MQTT** — a messaging system designed for small devices. The messages arrive at a central **MQTT broker** (think of it as a post office for meter data).

**Where the data lives:** Nowhere permanently. Messages exist in the broker's memory for a moment, then are delivered and gone — like a phone call.

**Data interface — MQTT message:**

Topic pattern: `community/{communityId}/meter/{meterId}/reading`

```json
{
  "meterId": "meter-alice-001",
  "timestamp": "2025-01-15T14:05:00.000Z",
  "powerW": 1200.0,
  "direction": "consumption"
}
```

| Field | Type | Description |
|---|---|---|
| `meterId` | `string` | Unique identifier for the physical meter |
| `timestamp` | `string` (ISO 8601) | UTC time of the reading |
| `powerW` | `number` | Instantaneous power in watts |
| `direction` | `string` | `"consumption"` or `"production"` |

One message per meter every 10 seconds. QoS 1 (at-least-once delivery). The ingestion service (Step 2) subscribes to `community/+/meter/+/reading`.

### Step 2: Readings are saved to a database

A small program called the **ingestion service** listens to all the messages from the MQTT broker and writes them into a database.

**Database:** **TimescaleDB** (a version of PostgreSQL built for time-based data like sensor readings).

**Table:** `raw_readings` — one row per meter per 10-second tick. That's roughly 52,000 rows per day for 8 meters. These are kept for 90 days, then automatically deleted to save space.

```
Time          │ Meter         │ Reading
──────────────┼───────────────┼─────────────────
14:05:00      │ Alice         │ using 1.2 kW
14:05:00      │ Solar Park    │ producing 6.0 kW
14:05:00      │ Battery       │ idle
14:05:10      │ Alice         │ using 1.1 kW
14:05:10      │ Solar Park    │ producing 5.9 kW
...
```

**Data interface — `raw_readings` table:**

```sql
CREATE TABLE raw_readings (
    time          TIMESTAMPTZ  NOT NULL,
    meter_id      TEXT         NOT NULL,
    community_id  TEXT         NOT NULL,
    power_w       REAL         NOT NULL,
    direction     TEXT         NOT NULL  -- 'consumption' or 'production'
);

SELECT create_hypertable('raw_readings', 'time');
SELECT add_retention_policy('raw_readings', INTERVAL '90 days');
```

Each MQTT message becomes one row:

```sql
INSERT INTO raw_readings (time, meter_id, community_id, power_w, direction)
VALUES ('2025-01-15 14:05:00+00', 'meter-alice-001', 'community-001', 1200.0, 'consumption');
```

### Step 3: Every 15 minutes, summarize

A scheduled job runs at :00, :15, :30, and :45 of every hour. It looks at all the 10-second readings from the past 15 minutes and calculates a single summary per meter: "Alice used 2.0 kWh in total."

**Database:** same **TimescaleDB**.

**Table:** `interval_readings` — one row per meter per 15-minute window. These are kept forever. This is the official record of what happened.

```
14:00–14:15   │ Alice         │ consumed 2.0 kWh
14:00–14:15   │ Bob           │ consumed 5.0 kWh
14:00–14:15   │ Carol         │ consumed 1.0 kWh
14:00–14:15   │ Dave          │ consumed 3.0 kWh
14:00–14:15   │ Solar Park    │ produced  8.0 kWh
14:00–14:15   │ Battery       │ discharged 2.0 kWh
14:00–14:15   │ Grid          │ imported 1.0 kWh
```

(Eve has no meter — she's an investor, not a consumer.)

**Data interface — `interval_readings` table:**

```sql
CREATE TABLE interval_readings (
    interval_start  TIMESTAMPTZ  NOT NULL,
    meter_id        TEXT         NOT NULL,
    community_id    TEXT         NOT NULL,
    energy_wh       INTEGER      NOT NULL,  -- watt-hours (integer avoids floating point)
    direction       TEXT         NOT NULL,
    reading_count   INTEGER      NOT NULL,  -- expected: ~90 per 15-min interval
    PRIMARY KEY (interval_start, meter_id)
);
```

**Aggregation formula:**

Each raw reading covers a 10-second window. Energy = Power × Time:

```
E_wh = Σ (power_w(i) × Δt_seconds) / 3600

With 10-second samples over 15 minutes (90 readings of 1200 W average):
E_wh = (90 × 1200 × 10) / 3600 = 3000 Wh = 3.0 kWh
```

**Aggregation SQL (runs every 15 minutes via pg_cron):**

```sql
INSERT INTO interval_readings
    (interval_start, meter_id, community_id, energy_wh, direction, reading_count)
SELECT
    time_bucket('15 minutes', time)               AS interval_start,
    meter_id,
    community_id,
    ROUND(SUM(power_w * 10.0) / 3600.0)::INTEGER AS energy_wh,
    direction,
    COUNT(*)                                      AS reading_count
FROM raw_readings
WHERE time >= time_bucket('15 minutes', NOW()) - INTERVAL '15 minutes'
  AND time <  time_bucket('15 minutes', NOW())
GROUP BY 1, 2, 3, 5;
```

`reading_count` detects data gaps — fewer than ~90 readings per meter means missing data.

**Output passed to Step 4 (SQL query result as JSON):**

```json
[
  { "meter_id": "meter-alice-001",   "energy_wh": 2000, "direction": "consumption" },
  { "meter_id": "meter-bob-001",     "energy_wh": 5000, "direction": "consumption" },
  { "meter_id": "meter-carol-001",   "energy_wh": 1000, "direction": "consumption" },
  { "meter_id": "meter-dave-001",    "energy_wh": 3000, "direction": "consumption" },
  { "meter_id": "meter-solar-001",   "energy_wh": 8000, "direction": "production"  },
  { "meter_id": "meter-battery-001", "energy_wh": 2000, "direction": "production"  },
  { "meter_id": "meter-grid-001",    "energy_wh": 1000, "direction": "import"      }
]
```

### Step 4: The EMS calculates who pays what

This is the brain of the system. The **EMS** (Energy Management System) is a backend program that does two things:

1. **Controls the battery** — it sends charge/discharge commands to the battery over MQTT. This is the only physical action the software takes. Everything else is just accounting.

2. **Runs the fair-split algorithm** — it takes the 15-minute summaries, looks up the community's rules, and calculates exactly how much energy each member should be attributed and at what price. (Part 2 of this document explains this algorithm in detail.)

**What the EMS reads:**

| Data | Where it comes from |
|---|---|
| How much each household consumed | `interval_readings` in TimescaleDB (Step 3) |
| How much the solar park produced | `interval_readings` in TimescaleDB (Step 3) |
| Each member's ownership percentage (per source) | The blockchain smart contract |
| Prices for solar, battery energy | The blockchain — set when the community created its PPAs (Power Purchase Agreements) |
| Prices for grid import/export | External APIs — e.g. energy retailer tariffs or spot market prices |

**Input from blockchain — per-source ownership configuration:**

The EMS reads ownership and fee config from the smart contract. Each source has its own set of owners with ownership expressed in **basis points** (bps): 10000 bps = 100%.

```json
{
  "sources": [
    {
      "sourceId": "solar-park-001",
      "sourceType": "LOCAL",
      "priceCt": 8,
      "owners": [
        { "member": "0xAlice...", "ownershipBps": 3000 },
        { "member": "0xBob...",   "ownershipBps": 3000 },
        { "member": "0xCarol...", "ownershipBps": 1000 },
        { "member": "0xDave...",  "ownershipBps": 2000 },
        { "member": "0xEve...",   "ownershipBps": 1000 }
      ]
    },
    {
      "sourceId": "battery-001",
      "sourceType": "BATTERY",
      "priceCt": 15,
      "owners": [
        { "member": "0xAlice...", "ownershipBps": 2500 },
        { "member": "0xBob...",   "ownershipBps": 2500 },
        { "member": "0xDave...",  "ownershipBps": 2500 },
        { "member": "0xEve...",   "ownershipBps": 2500 }
      ]
    }
  ],
  "gridImportPriceCt": 25,
  "gridExportPriceCt": 5,
  "communityFeeBps": 500,
  "aggregatorFeeBps": 300
}
```

Each source's `ownershipBps` values must sum to 10000.

**How the EMS transforms interval readings into settlement entries:**

The EMS takes the raw interval readings from Step 3 and the ownership config above, then runs the three-pass algorithm. Here is the exact math for this interval:

```
INPUT (from interval_readings):
  Consumers:  Alice = 2000 Wh, Bob = 5000 Wh, Carol = 1000 Wh, Dave = 3000 Wh
  Sources:    solar = 8000 Wh (8 ct/kWh), battery = 2000 Wh (15 ct/kWh)
  Grid:       1000 Wh imported (25 ct/kWh)

PASS 1 — Ownership allocation (per source, cheapest first):

  Solar shares (8000 Wh × ownership%):
    Alice: 8000 × 0.30 = 2400    Bob: 8000 × 0.30 = 2400
    Carol: 8000 × 0.10 =  800    Dave: 8000 × 0.20 = 1600    Eve: 8000 × 0.10 = 800

  Battery shares (2000 Wh × ownership%):
    Alice: 2000 × 0.25 =  500    Bob: 2000 × 0.25 =  500
    Carol: 2000 × 0.00 =    0    Dave: 2000 × 0.25 =  500    Eve: 2000 × 0.25 = 500

  Consume own shares (cheapest first → solar then battery):
    Alice: needs 2000, has 2400S + 500B → uses 2000S, surplus = 400S + 500B
    Bob:   needs 5000, has 2400S + 500B → uses 2400S + 500B, deficit = 2100
    Carol: needs 1000, has  800S +   0B → uses  800S, deficit = 200
    Dave:  needs 3000, has 1600S + 500B → uses 1600S + 500B, deficit = 900
    Eve:   needs    0, has  800S + 500B → uses nothing, surplus = 800S + 500B

PASS 2 — Redistribute surplus per source:

  Solar surplus: 400 (Alice) + 800 (Eve) = 1200 Wh
  Deficit members with solar ownership: Bob 30% + Carol 10% + Dave 20% = 60%

    Bob:   1200 × 30/60 =  600 Wh → deficit: 2100 − 600 = 1500
    Carol: 1200 × 10/60 =  200 Wh → deficit:  200 − 200 =    0 ✓
    Dave:  1200 × 20/60 =  400 Wh → deficit:  900 − 400 =  500

  Battery surplus: 500 (Alice) + 500 (Eve) = 1000 Wh
  Deficit members with battery ownership: Bob 25% + Dave 25% = 50%

    Bob:  1000 × 25/50 =  500 Wh → deficit: 1500 − 500 = 1000
    Dave: 1000 × 25/50 =  500 Wh → deficit:  500 − 500 =    0 ✓

PASS 3 — Grid import:

    Bob: 1000 Wh at 25 ct/kWh

RESULT — Total energy per member per source:
    Alice: solar = 2000 Wh
    Bob:   solar = 2400 + 600 = 3000 Wh,  battery = 500 + 500 = 1000 Wh,  grid = 1000 Wh
    Carol: solar =  800 + 200 = 1000 Wh
    Dave:  solar = 1600 + 400 = 2000 Wh,  battery = 500 + 500 = 1000 Wh

CHECK: solar 2000+3000+1000+2000 = 8000 ✓  battery 1000+1000 = 2000 ✓  grid 1000 ✓
```

Each (member, source, amount) tuple becomes one settlement entry with the source's price attached.

**What the EMS produces:** A list of readings — one per member per energy source — that says who consumed how much, from what source, at what price. This is the input for the blockchain.

**Database:** The EMS saves its calculation to **PostgreSQL**, table called `settlement_batches`. This is the receipt — a record of exactly what was sent to the blockchain and why. Kept forever.

**Output — settlement entries (saved to PostgreSQL, then sent to blockchain):**

```json
{
  "intervalStart": "2025-01-15T14:00:00Z",
  "intervalEnd": "2025-01-15T14:15:00Z",
  "communityId": "community-001",
  "entries": [
    { "deviceId": 1001, "amountWh": 2000, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 2001, "amountWh": 3000, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 2001, "amountWh": 1000, "priceCt": 15, "source": "BATTERY" },
    { "deviceId": 2001, "amountWh": 1000, "priceCt": 25, "source": "IMPORT"  },
    { "deviceId": 3001, "amountWh": 1000, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 4001, "amountWh": 2000, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 4001, "amountWh": 1000, "priceCt": 15, "source": "BATTERY" }
  ],
  "txHash": null,
  "status": "pending"
}
```

Device 1001 = Alice, 2001 = Bob, 3001 = Carol, 4001 = Dave. Eve has no device (investor).

**`settlement_batches` table:**

```sql
CREATE TABLE settlement_batches (
    id              SERIAL       PRIMARY KEY,
    interval_start  TIMESTAMPTZ  NOT NULL,
    interval_end    TIMESTAMPTZ  NOT NULL,
    community_id    TEXT         NOT NULL,
    entries         JSONB        NOT NULL,
    tx_hash         TEXT,
    status          TEXT         NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_interval
    ON settlement_batches (community_id, interval_start);
```

Status transitions: `pending` → `submitted` (tx sent) → `confirmed` (tx mined) or `failed`.

### Step 5: The blockchain records the settlement

The EMS sends its list of readings to a **smart contract** on the blockchain in a single transaction. Here is what that data looks like for the interval above:

```
settleInterval([
  { device: Alice,  amount: 2.00 kWh, price:  8 ct, source: LOCAL   },
  { device: Bob,    amount: 3.00 kWh, price:  8 ct, source: LOCAL   },
  { device: Bob,    amount: 1.00 kWh, price: 15 ct, source: BATTERY },
  { device: Bob,    amount: 1.00 kWh, price: 25 ct, source: IMPORT  },
  { device: Carol,  amount: 1.00 kWh, price:  8 ct, source: LOCAL   },
  { device: Dave,   amount: 2.00 kWh, price:  8 ct, source: LOCAL   },
  { device: Dave,   amount: 1.00 kWh, price: 15 ct, source: BATTERY },
])
```

A member can appear multiple times — once for each energy source at a different price. The source tag tells the contract where the energy came from: LOCAL (solar), BATTERY, or IMPORT (grid).

Revenue from each source goes to that source's owners. IMPORT charges go to the import balance (the community's bill to the external grid).

The smart contract processes these readings in two steps:

**Step A — Charge each consumer.** Multiply amount × price and debit the member.

**Step B — Split revenue per source.** Revenue from each source is split separately: community fee → aggregator fee → remainder to that source's owners by their ownership %. This means solar revenue goes to solar owners and battery revenue goes to battery owners.

The contract also runs a safety check: every cent charged to someone must appear as a credit somewhere else. If the math doesn't add up to zero, the entire transaction is rejected.

**Solidity interface (from `IEnergyPPA.sol`):**

```solidity
enum Source { LOCAL, IMPORT }

struct ConsumptionReading {
    uint256 deviceId;      // maps to a member via deviceToMember[]
    uint256 quantity;       // energy amount (contract-internal units)
    uint256 pricePerKwh;   // price (contract-internal units)
    Source  source;         // LOCAL = solar/battery revenue, IMPORT = grid cost
}

struct MemberPPA {
    address memberAddress;
    uint256[] deviceIds;
    uint256 ownershipBps;  // basis points: 10000 = 100%
    bool isActive;
    bytes32 metadataHash;
}

function consumeEnergy(ConsumptionReading[] calldata readings) external;
```

> **Note:** The current `EnergyPPAImplementation.sol` contract has a single `ownershipBps` per member and only `LOCAL`/`IMPORT` source types. The per-source ownership model described in this document (separate solar vs battery ownership, `BATTERY` source type) requires extending the contract with per-source ownership mappings and an additional `BATTERY` source enum value.

**On-chain formulas (inside `consumeEnergy()`):**

```
// Step A — Charge consumers
For each reading r:
    charge = r.quantity × r.pricePerKwh
    balance[owner_of(r.deviceId)] -= charge       // debit consumer

    if r.source == LOCAL:
        totalLocalRevenue += charge                // into revenue pot
    else if r.source == IMPORT:
        importCashCreditBalance += charge          // grid cost tracker

// Step B — Split LOCAL revenue to fees + owners
communityFee  = totalLocalRevenue × communityFeeBps / 10000
aggregatorFee = totalLocalRevenue × aggregatorFeeBps / 10000
ownerPool     = totalLocalRevenue - communityFee - aggregatorFee

balance[communityAddress]   += communityFee
balance[aggregatorAddress]  += aggregatorFee

For each member m (last member gets remainder to avoid rounding dust):
    if m is last member:
        share = ownerPool - alreadyDistributed
    else:
        share = ownerPool × m.ownershipBps / 10000
    balance[m] += share

// Step C — Zero-sum check (ensureZeroSum modifier)
Σ_m balance[m] + importBalance + exportBalance + settledBalance == 0
// If this fails, the entire transaction reverts.
```

**Events emitted per settlement:**

```solidity
event EnergyConsumed(address indexed consumer, uint256 quantity, uint256 price, Source source);
event CommunityFeeCollected(address indexed community, uint256 amount);
event AggregatorFeeCollected(address indexed aggregator, uint256 amount);
event RevenueDistributed(address indexed owner, uint256 amount, uint256 totalRevenue);
event EnergyExported(uint256 quantity, uint256 revenue);
```

**Balance representation:**

| Balance state | Storage | Visible as |
|---|---|---|
| Positive (credit) | `EnergyToken.balanceOf(member)` | ERC-20 token in any wallet |
| Negative (debt) | `cashCreditBalances[member]` (int256) | Debt shown in community dApp |
| Zero | Nothing stored | — |

The contract uses a dual representation: positive balances are ERC-20 tokens (transferable, visible in wallets), while negative balances are internal int256 mappings.

**Where the data lives:** On the blockchain, permanently. Balances are stored in the smart contract. Positive balances become visible as **Energy Credits** (an ERC-20 token) in members' crypto wallets.

### Step 6: Members settle with real money

Over time, members who consume more than they earn accumulate debt. Members who own a large share but consume little accumulate credits. Periodically, members pay their debt using digital euros (a stablecoin like EURC).

**Data interface — settlement functions:**

Two contracts are involved: the `EnergyPPAImplementation` (holds balances) and the `EnergySettlement` helper (handles EURC transfers).

```solidity
// In EnergyPPAImplementation.sol:
function settleOwnDebt(uint256 stablecoinAmount) external;
function settleDebt(address debtor, uint256 stablecoinAmount) external;

// In EnergySettlement.sol (standalone helper):
function settleOwnDebt(uint256 eurcAmount) external;
function settleDebt(address debtor, uint256 eurcAmount) external;
function getDebtInEurc(address debtor) external view returns (uint256);
```

**EURC conversion math:**

EURC uses 6 decimal places. The contract's internal balances use a simpler unit (effectively cents). The conversion factor is **10,000**:

```
internal_amount = eurc_amount / 10000
eurc_amount     = internal_amount × 10000

Example: Bob owes 39.44 ct (internal balance = -3944)
  EURC needed = 3944 × 10000 = 39,440,000 base units = 39.44 EURC
```

**Settlement flow (two ERC-20 transactions):**

```
1. Bob calls:  EURC.approve(settlementContract, 39440000)
2. Bob calls:  EnergySettlement.settleOwnDebt(39440000)

Inside the contract:
   a. energySystemAmount = 39440000 / 10000 = 3944
   b. debt = abs(balance[Bob]) = 3944
   c. settle = min(3944, 3944) = 3944
   d. EURC.transferFrom(Bob → contract → paymentRecipient)
   e. balance[Bob] += 3944  →  balance[Bob] = 0
   f. settledBalance -= 3944  (tracks external money entering system)
```

---

### The full pipeline at a glance

```
Smart Meters
  │
  │  MQTT messages every 10 seconds
  ▼
MQTT Broker (temporary, in memory)
  │
  │  Ingestion service writes to database
  ▼
TimescaleDB: "raw_readings" (kept 90 days)
  │
  │  Scheduled summary every 15 minutes
  ▼
TimescaleDB: "interval_readings" (kept forever)
  │
  │  EMS reads summaries + prices
  ▼
EMS Backend (runs the fair-split algorithm, controls battery)
  │
  │  Saves its calculation
  ▼
PostgreSQL: "settlement_batches" (kept forever)
  │
  │  Sends one transaction to blockchain
  ▼
Blockchain Smart Contract (permanent, tamper-proof)
  │
  │  Charges consumers, distributes revenue per source, verifies zero-sum
  ▼
Member balances (on-chain), settled with EURC stablecoin
```

---

## Part 2 — Inside the EMS: How Energy Is Fairly Divided

The EMS runs a three-step algorithm every 15 minutes. The goal: give each member their fair share of cheap energy — based on how much of each source they own — before anyone has to buy expensive grid electricity.

### Where prices come from

The EMS needs to know the price of each energy source. These come from two places:

| Price | Where it comes from |
|---|---|
| Solar energy price | **Blockchain** — set when the community created their PPA (Power Purchase Agreement). This is the agreed internal price for solar. |
| Battery charge/discharge price | **Blockchain** — also part of the PPA configuration. A small markup on top of the solar price to cover battery wear. |
| Community and aggregator fees | **Blockchain** — configured when the community was set up. |
| Grid import price | **External API** — the current electricity price from the energy retailer or spot market. Changes over time. |
| Grid export price | **External API** — the feed-in tariff, i.e. what the grid pays the community for surplus energy sold back. |

In short: internal community prices live on the blockchain (transparent, agreed upon by all members). External market prices come from APIs (they change with market conditions).

### The battery

The EMS is the part that **controls the battery**. Throughout the day, it decides when to charge (store excess solar) and when to discharge (release stored energy during high demand or high prices). These charge/discharge commands are sent over MQTT, just like meter readings but in reverse. This is the only physical action the software takes — everything else is accounting.

### Formal algorithm definitions

Let:
- **S** = set of energy sources, ordered by price ascending (solar at 8 ct < battery at 15 ct)
- **M** = set of all members
- For each source *s* ∈ S: **P(s)** = total production (Wh), **p(s)** = price (ct/kWh), **o(s,m)** = ownership fraction of member *m* in source *s*
- For each member *m* ∈ M: **C(m)** = total consumption (Wh)

Pass 1 — Ownership allocation:

```
For each member m:
    remaining(m) = C(m)
    For each source s (cheapest first):
        share(s,m)   = o(s,m) × P(s)
        used(s,m)    = min( share(s,m), remaining(m) )
        remaining(m) = remaining(m) - used(s,m)
        surplus(s,m) = share(s,m) - used(s,m)
    deficit(m) = remaining(m)
```

Pass 2 — Redistribute surplus per source:

```
For each source s (cheapest first):
    pool(s)  = Σ_m surplus(s,m)
    D(s)     = { m ∈ M : deficit(m) > 0 AND o(s,m) > 0 }
    W(s)     = Σ_{m ∈ D(s)} o(s,m)

    For each m ∈ D(s):
        alloc      = pool(s) × o(s,m) / W(s)
        extra      = min( alloc, deficit(m) )
        used(s,m)  = used(s,m) + extra
        deficit(m) = deficit(m) - extra
        pool(s)    = pool(s) - extra

    If any member hit their deficit cap (extra < alloc),
    repeat with remaining pool and remaining D(s).
```

Pass 3 — Grid import:

```
For each m where deficit(m) > 0:
    grid(m) = deficit(m)
```

Cost per member:

```
cost(m) = Σ_s [ used(s,m) × p(s) ] + grid(m) × p_grid
```

Invariants (must hold after every interval):

```
Σ_m C(m)         = Σ_s P(s) + Σ_m grid(m)          (energy balance)
Σ_s Σ_m used(s,m) = Σ_s P(s)                         (all local energy consumed)
Σ_m cost(m)       = Σ_s [P(s) × p(s)] + grid_total × p_grid   (revenue balance)
```

### The algorithm: a worked example

**This interval's numbers:**

```
Solar park produced:     8 kWh   (at 8 ct/kWh — from the PPA on-chain)
Battery discharged:      2 kWh   (at 15 ct/kWh — from the PPA on-chain)
Total local energy:     10 kWh

Alice consumed:          2 kWh
Bob consumed:            5 kWh
Carol consumed:          1 kWh
Dave consumed:           3 kWh
Eve consumed:            0 kWh   (investor — not connected)
Total consumed:         11 kWh

Shortfall:  11 - 10 = 1 kWh → must be imported from grid (at 25 ct/kWh — from API)

Solar ownership:   Alice 30% │ Bob 30% │ Carol 10% │ Dave 20% │ Eve 10%
Battery ownership: Alice 25% │ Bob 25% │ Carol  0% │ Dave 25% │ Eve 25%
```

Solar and battery have different prices because the battery price includes a markup for wear and storage costs. They also have **different ownership structures** — Carol invested in the solar park but not the battery. The algorithm always uses the cheapest source first: solar (8 ct), then battery (15 ct), then grid (25 ct).

### Step 1 — Give each member their ownership share of each source

Each member gets their percentage of each energy source separately, using that source's ownership table.

```
Solar (8 kWh at 8 ct/kWh) — solar ownership:
                 Ownership    Solar share
Alice (30%):     30%          2.4 kWh
Bob   (30%):     30%          2.4 kWh
Carol (10%):     10%          0.8 kWh
Dave  (20%):     20%          1.6 kWh
Eve   (10%):     10%          0.8 kWh

Battery (2 kWh at 15 ct/kWh) — battery ownership:
                 Ownership    Battery share
Alice (25%):     25%          0.5 kWh
Bob   (25%):     25%          0.5 kWh
Carol  (0%):      —           —
Dave  (25%):     25%          0.5 kWh
Eve   (25%):     25%          0.5 kWh
```

Carol gets no battery share — she has 0% battery ownership.

Each member consumes their cheapest share (solar) first, then battery. Compare what they **need** vs. what they **have**:

```
           Solar share   Battery share   Total share    Needs    Result
Alice:     2.4 kWh       0.5 kWh         2.9 kWh        2.0     Surplus: 0.9 kWh
Bob:       2.4           0.5             2.9            5.0     Deficit: 2.1 kWh
Carol:     0.8           —               0.8            1.0     Deficit: 0.2 kWh
Dave:      1.6           0.5             2.1            3.0     Deficit: 0.9 kWh
Eve:       0.8           0.5             1.3            0.0     Surplus: 1.3 kWh
```

Alice used less than her share — she only needed 2.0 kWh of her 2.9. Since she uses solar first, she consumes 2.0 kWh of solar and has **0.4 kWh solar + 0.5 kWh battery** left over.

Eve consumed nothing. Her entire share is surplus: **0.8 kWh solar + 0.5 kWh battery**.

Carol has no battery share at all (0% battery ownership), so her only share is 0.8 kWh of solar.

Bob and Dave consumed more than their share. They need more energy.

### Step 2 — Redistribute surplus by source ownership

The surplus from Alice and Eve goes to the members who need more — **split proportionally by their ownership of that source**, not first-come-first-served. Since solar and battery have different prices and different owners, surplus is distributed one source at a time, cheapest first.

**First, distribute the solar surplus (0.4 from Alice + 0.8 from Eve = 1.2 kWh at 8 ct/kWh):**

Deficit members with solar ownership: Bob (30%) + Carol (10%) + Dave (20%) = 60% combined.

```
Bob gets:   1.2 × (30/60) = 0.60 kWh of solar
Carol gets: 1.2 × (10/60) = 0.20 kWh of solar  ← exactly covers Carol
Dave gets:  1.2 × (20/60) = 0.40 kWh of solar
```

**Then, distribute the battery surplus (0.5 from Alice + 0.5 from Eve = 1.0 kWh at 15 ct/kWh):**

Deficit members with battery ownership: Bob (25%) + Dave (25%) = 50% combined. Carol has 0% battery ownership — no battery surplus for her.

```
Bob gets:   1.0 × (25/50) = 0.50 kWh of battery
Dave gets:  1.0 × (25/50) = 0.50 kWh of battery  ← exactly covers Dave
```

This is the key idea: **surplus is divided proportionally based on ownership of each source**. A member who owns more of a source gets a bigger share of that source's surplus. Each source keeps its own price — the cheap solar surplus stays at 8 ct, and the pricier battery surplus stays at 15 ct. Carol can't receive battery surplus because she didn't invest in the battery.

After redistribution, Bob still needs 1.0 kWh.

### Step 3 — Remaining deficit comes from the grid

Bob still needs 1.0 kWh. That comes from the grid at the expensive import price (25 ct/kWh).

### The final bill

```
             Solar          Battery         Grid          Total cost
             kWh    cost    kWh    cost     kWh   cost
Alice:       2.00   16.0    —       —       —      —      16.00 ct
Bob:         3.00   24.0    1.00   15.0     1.0   25.0    64.00 ct
Carol:       1.00    8.0    —       —       —      —       8.00 ct
Dave:        2.00   16.0    1.00   15.0     —      —      31.00 ct
Eve:         —       —      —       —       —      —       0.00 ct
             ────          ────            ────           ──────
Total:       8.00   64.0   2.00   30.0     1.00  25.0    119.00 ct
```

Check: 8 × 8 + 2 × 15 + 1 × 25 = 64 + 30 + 25 = 119 ct. Correct.

Alice pays only for solar because she consumed less than her share. Carol pays only for solar — she got her 0.2 kWh shortfall covered by solar surplus redistribution. Bob pays the most because he consumed the most and needed expensive grid electricity. Dave pays for solar and battery but no grid — the battery surplus exactly covered his remaining deficit. Eve pays nothing — she's an investor.

### What happens on-chain: the settlement

The EMS sends the readings above to the smart contract. The contract does two things:

**1. Charge each consumer.** Every reading gets multiplied out: amount × price.

**2. Split revenue per source.** Revenue from each source is split separately among that source's owners.

```
Solar revenue (LOCAL): 64.00 ct
  Alice: 2.00 × 8 = 16.00
  Bob:   3.00 × 8 = 24.00
  Carol: 1.00 × 8 =  8.00
  Dave:  2.00 × 8 = 16.00

  Community fee (5%):   64.00 × 5%  =  3.20 ct  → community treasury
  Aggregator fee (3%):  64.00 × 3%  =  1.92 ct  → operator (Hypha Energy)
  Remaining for solar owners:          58.88 ct

  Distributed by solar ownership:
    Alice (30%):  58.88 × 30% = 17.66 ct
    Bob   (30%):  58.88 × 30% = 17.66 ct
    Carol (10%):  58.88 × 10% =  5.89 ct
    Dave  (20%):  58.88 × 20% = 11.78 ct
    Eve   (10%):  58.88 × 10% =  5.89 ct
```

```
Battery revenue (BATTERY): 30.00 ct
  Bob:   1.00 × 15 = 15.00
  Dave:  1.00 × 15 = 15.00

  Community fee (5%):   30.00 × 5%  =  1.50 ct
  Aggregator fee (3%):  30.00 × 3%  =  0.90 ct
  Remaining for battery owners:        27.60 ct

  Distributed by battery ownership:
    Alice (25%):  27.60 × 25% =  6.90 ct
    Bob   (25%):  27.60 × 25% =  6.90 ct
    Dave  (25%):  27.60 × 25% =  6.90 ct
    Eve   (25%):  27.60 × 25% =  6.90 ct
```

Carol earns nothing from battery — she has 0% battery ownership.

```
Import balance:
  Bob:    1.00 × 25           = 25.00 ct
```

### On-chain Energy Credit balances after this interval

Each member's balance = what they earned (revenue share from all sources) minus what they were charged (consumption). The contract stores these on the blockchain.

```
               Charged     Earned      Balance     Meaning
Alice:         -16.00      +24.56      +8.56 ct    Credit (community owes Alice)
Bob:           -64.00      +24.56      -39.44 ct   Debt (Bob owes community)
Carol:          -8.00       +5.89      -2.11 ct    Debt (small)
Dave:          -31.00      +18.68      -12.32 ct   Debt (Dave owes community)
Eve:             0.00      +12.79      +12.79 ct   Credit (pure investor earnings)

Community:        —         +4.70      +4.70 ct    Fee income
Aggregator:       —         +2.82      +2.82 ct    Operator fee income
Import:           —           —        +25.00 ct   Grid electricity bill
```

Earned breakdown: Alice = 17.66 solar + 6.90 battery = 24.56. Bob = 17.66 + 6.90 = 24.56. Carol = 5.89 solar only. Dave = 11.78 + 6.90 = 18.68. Eve = 5.89 + 6.90 = 12.79. Community fee = 3.20 + 1.50 = 4.70. Aggregator fee = 1.92 + 0.90 = 2.82.

**Zero-sum check:** +8.56 − 39.44 − 2.11 − 12.32 + 12.79 + 4.70 + 2.82 + 25.00 = **0.00**

Everything balances. The contract verifies this — if it doesn't sum to zero, the entire transaction is rejected.

**What the balances mean:**

- **Positive balance** (Alice, Eve) → stored as **Energy Credits** (an ERC-20 token visible in any crypto wallet). The community owes them money. Alice earned more from her ownership shares (solar + battery) than she spent on electricity. Eve earned purely from ownership of both sources.
- **Negative balance** (Bob, Carol, Dave) → stored as internal debt. They consumed more than they earned. They'll settle this debt later by paying stablecoin (EURC). Carol's debt is especially notable: she only earns solar revenue (5.89 ct) since she didn't invest in the battery.
- **Community & Aggregator** → fee income that accumulates over time.
- **Import balance** → the community's electricity bill to the external grid. Paid separately to the energy retailer.

### Why this is better than the old system

The previous on-chain system processed members sequentially in a loop. It built a pool of energy sorted by price, then let each member consume from it one by one. The problem: **array order determined who got cheap energy**.

If Alice was first in the array, she'd eat the cheap solar entries before anyone else. If she was last, those entries were already taken and she'd be stuck paying grid prices. Same community, same production, same consumption — but a member's bill could swing by over 100% just by reordering the input array.

The old system also used a single price for all local energy and a single ownership percentage for all sources. There was no way to give solar a different price than battery, or to have different investors in different sources. In reality, battery energy costs more (wear, storage losses), and different members may choose to invest in different assets.

The new system solves both problems:
- **Fair distribution** — surplus is split proportionally by ownership of each source, not sequentially. Every member's cost depends only on how much they consumed, how much they own of each source, and how much energy was available. Not on their position in a list.
- **Per-source pricing and ownership** — solar, battery, and grid each carry their own price and their own ownership table. A member like Carol can invest in solar without investing in the battery. The algorithm uses the cheapest source first, and each kWh keeps the price of its actual source all the way through to the bill.

---

## Example 2 — What happens when the community produces more than it needs (export)

Sometimes the solar park produces more electricity than all members consume. The surplus is sold back to the grid. On the blockchain, the export is treated as just another "consumer" — the export device — that takes the leftover energy.

**This interval's numbers:**

```
Solar park produced:    10 kWh   (at 8 ct/kWh — from the PPA)
Battery:                idle     (no battery revenue this interval)

Alice consumed:          2 kWh
Bob consumed:            2 kWh
Carol consumed:          1 kWh
Dave consumed:           1 kWh
Eve consumed:            0 kWh   (investor)
Total consumed:          6 kWh

Surplus:  10 - 6 = 4 kWh → exported to grid (at 5 ct/kWh — feed-in tariff from API)
```

It's a sunny afternoon and nobody is home. The community produces way more than it uses. Only solar is active — battery ownership doesn't apply this interval.

### Step 1 — Give each member their ownership share

```
Solar (10 kWh at 8 ct/kWh) — solar ownership:
                 Share       Needs      Uses       Surplus
Alice (30%):     3.0 kWh     2.0 kWh    2.0 kWh    1.0 kWh
Bob   (30%):     3.0 kWh     2.0 kWh    2.0 kWh    1.0 kWh
Carol (10%):     1.0 kWh     1.0 kWh    1.0 kWh    —
Dave  (20%):     2.0 kWh     1.0 kWh    1.0 kWh    1.0 kWh
Eve   (10%):     1.0 kWh     0.0 kWh    —           1.0 kWh
```

Every member (except Carol, who uses exactly her share) has more solar than they need. Nobody has a deficit.

### Step 2 — Redistribute surplus

No redistribution needed — nobody needs more energy. Skip.

### Step 3 — Leftover energy is exported

Total surplus: 1.0 + 1.0 + 1.0 + 1.0 = 4.0 kWh. This is sold to the grid at 5 ct/kWh.

### What the EMS sends to the blockchain

The EMS builds a list of readings, including the export as its own entry:

```
settleInterval([
  { device: Alice,   amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Bob,     amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Carol,   amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Dave,    amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Export,  amount: 4.0 kWh, price: 5 ct, source: LOCAL  },
])
```

The export is just another line in the list. The smart contract processes it the same way — the export revenue goes into the solar revenue pot alongside the consumption charges.

### The money

```
Solar revenue pot:
  LOCAL consumption charges:  (2 + 2 + 1 + 1) × 8  = 48.00 ct
  Export revenue:             4 × 5                  = 20.00 ct
                                                      ───────
  Total solar revenue:                                  68.00 ct

Battery is idle — no battery revenue this interval.

Community fee (5%):    68.00 × 5%  =  3.40 ct
Aggregator fee (3%):   68.00 × 3%  =  2.04 ct
Remaining for solar owners:          62.56 ct

Solar owner distribution:
  Alice (30%):  62.56 × 30% = 18.77 ct
  Bob   (30%):  62.56 × 30% = 18.77 ct
  Carol (10%):  62.56 × 10% =  6.26 ct
  Dave  (20%):  62.56 × 20% = 12.51 ct
  Eve   (10%):  62.56 × 10% =  6.26 ct
```

### On-chain Energy Credit balances

```
               Charged     Earned      Balance     Meaning
Alice:         -16.00      +18.77      +2.77 ct    Credit (earns money)
Bob:           -16.00      +18.77      +2.77 ct    Credit (earns money)
Carol:          -8.00       +6.26      -1.74 ct    Small debt
Dave:           -8.00      +12.51      +4.51 ct    Credit (earns money)
Eve:             0.00       +6.26      +6.26 ct    Credit (investor earnings)

Community:        —         +3.40      +3.40 ct    Fee income
Aggregator:       —         +2.04      +2.04 ct    Operator fee income
Export:           —           —        -20.00 ct   Grid owes community for exported energy
```

**Zero-sum check:** +2.77 + 2.77 − 1.74 + 4.51 + 6.26 + 3.40 + 2.04 − 20.00 ≈ **0.00**

When production exceeds consumption, almost everyone earns a credit. The export revenue — money the grid owes the community for the surplus electricity — gets pooled together with consumption charges and distributed to all solar owners. Even Eve, who didn't consume anything, earns 6.26 ct from her 10% solar ownership.

Carol is the only one with a small debt (-1.74 ct) because her 10% solar ownership share earns less revenue than the 8 ct/kWh she paid for her 1 kWh of solar. She also has no battery ownership to supplement her earnings. Larger owners like Alice and Dave earn more from the revenue split than they paid for their consumption.

---

## Infrastructure: Where Everything Lives and What Runs It

This section maps every function and data store to a concrete service, with recommendations for production deployment.

### Service architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE (on-site hardware)                             │
│                                                                             │
│   Smart Meters ──MQTT──▶ Mosquitto Broker (local gateway, optional)        │
│                           │                                                 │
└───────────────────────────┼─────────────────────────────────────────────────┘
                            │ TLS over internet
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD  (managed services)                           │
│                                                                             │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐     │
│   │  MQTT Broker  │────▶│  Ingestion Svc   │────▶│  TimescaleDB       │     │
│   │  (HiveMQ)     │     │  (Node.js)       │     │  raw_readings      │     │
│   └──────────────┘     └──────────────────┘     │  interval_readings │     │
│                                                  └─────────┬──────────┘     │
│                                                            │                │
│                                                   pg_cron every 15 min      │
│                                                            │                │
│   ┌──────────────────┐                                     │                │
│   │  Price APIs       │─────────┐                          │                │
│   │  (retailer/spot)  │         │                          │                │
│   └──────────────────┘         ▼                          ▼                │
│                          ┌──────────────────────────────────────┐           │
│                          │           EMS Backend                │           │
│                          │  (Node.js / Docker on Railway/Fly)   │           │
│                          │                                      │           │
│                          │  • Reads interval_readings           │           │
│                          │  • Reads ownership from blockchain   │           │
│                          │  • Runs 3-pass algorithm             │           │
│                          │  • Controls battery via MQTT         │           │
│                          │  • Writes settlement_batches         │           │
│                          │  • Sends tx to blockchain            │           │
│                          └──────────────┬───────────────────────┘           │
│                                         │                                   │
│                   ┌─────────────────────┼────────────────────┐              │
│                   ▼                     ▼                    ▼              │
│   ┌─────────────────────┐  ┌───────────────────┐  ┌─────────────────┐     │
│   │    PostgreSQL        │  │    Blockchain      │  │    Grafana       │     │
│   │  settlement_batches  │  │  (Base)             │  │  (dashboards)    │     │
│   └─────────────────────┘  │  EnergyPPA contract │  └─────────────────┘     │
│                             │  EnergyToken (ERC20)│                          │
│                             │  EURC settlement    │                          │
│                             └───────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step service mapping

#### Step 1 — Meter readings (MQTT)

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **MQTT broker** | **HiveMQ Cloud** (managed) | Mosquitto (self-hosted on VPS) | HiveMQ has a free tier for < 100 devices. Mosquitto is free but you manage uptime. |
| **On-site gateway** | Optional **Mosquitto** on a Raspberry Pi | EMQX Edge | Buffers readings if internet drops, forwards to cloud broker when reconnected. Not strictly needed if meters have reliable connectivity. |
| **Meter authentication** | TLS client certificates per meter | Username/password per meter | Certificates are harder to set up but more secure. HiveMQ supports both. |
| **Topic structure** | `community/{id}/meter/{id}/reading` | — | Use MQTT wildcards for the ingestion service subscriber: `community/+/meter/+/reading` |

**Cost:** HiveMQ Cloud free tier → €0. Mosquitto self-hosted on a €5/month VPS.

#### Step 2 — Ingestion service (MQTT → TimescaleDB)

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Runtime** | **Node.js** (TypeScript) in a Docker container | Python with `paho-mqtt` | Node.js has excellent MQTT libraries (`mqtt.js`) and low memory footprint. |
| **Hosting** | **Railway** or **Fly.io** (always-on container) | AWS ECS Fargate, Google Cloud Run (min 1 instance) | This service must be always-on — it's a persistent MQTT subscriber, not a request-response service. Cloud Run's scale-to-zero doesn't work here. |
| **Duplicate detection** | Deduplicate by `(meter_id, timestamp)` in application code | `ON CONFLICT DO NOTHING` in PostgreSQL | MQTT QoS 1 can deliver duplicates. Handle at insert. |
| **Batching** | Buffer ~100 readings in memory, flush with `COPY` every 1–2 seconds | Individual INSERTs | `COPY` is 10–50× faster than row-by-row INSERT for TimescaleDB. |

**Cost:** Railway starter plan ~€5/month. Fly.io ~€3/month for a small always-on machine.

#### Step 3 — Aggregation (raw → interval readings)

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Scheduler** | **pg_cron** (runs inside TimescaleDB) | External cron via Railway/Fly, or TimescaleDB continuous aggregates | pg_cron is simplest — one SQL statement scheduled `*/15 * * * *`. Zero additional infrastructure. |
| **Database** | **Timescale Cloud** (managed TimescaleDB) | Self-hosted TimescaleDB on Railway/Fly, AWS RDS + TimescaleDB extension | Timescale Cloud includes pg_cron, automatic retention policies, and built-in monitoring. |
| **Retention** | `add_retention_policy('raw_readings', '90 days')` | Manual cron cleanup | TimescaleDB native retention is set-and-forget. |
| **Continuous aggregates** | Optional: use TimescaleDB continuous aggregates instead of pg_cron INSERT | — | Continuous aggregates auto-refresh materialized views. Slightly more complex to set up but handles late-arriving data better. |

**Cost:** Timescale Cloud ~€30/month (Starter). Self-hosted PostgreSQL+TimescaleDB on a €10/month VPS.

#### Step 4 — EMS backend (the algorithm)

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Runtime** | **Node.js** (TypeScript) in a Docker container | Python | Same language as the ingestion service for shared libraries and types. |
| **Hosting** | **Railway** or **Fly.io** | AWS Lambda (triggered every 15 min), Google Cloud Functions | Can be a cron-triggered job or a long-running service that sleeps between intervals. Lambda works if execution stays under 15 min (it will — the algorithm takes milliseconds). |
| **Trigger** | pg_cron calls `pg_notify()` after aggregation → EMS listens via `LISTEN/NOTIFY` | Poll `interval_readings` every minute, or use a message queue | `LISTEN/NOTIFY` gives sub-second trigger latency with zero infrastructure. The EMS holds a PostgreSQL connection and gets a push notification when new interval data is ready. |
| **Blockchain reads** | **ethers.js** or **viem** — read ownership config from `EnergyPPAImplementation` contract | TheGraph subgraph for indexed queries | Direct RPC reads are fine for small communities. For 100+ members, consider caching ownership in PostgreSQL and syncing on changes (listen to `MemberAdded`/`MemberRemoved` events). |
| **Price APIs** | Fetch grid import/export prices from retailer API or spot market API at the start of each interval | Cache prices with a 15-min TTL | Specific API depends on the country and energy retailer. |
| **Battery control** | Publish MQTT commands: `community/{id}/battery/command` with `{ "action": "charge", "powerW": 5000 }` | — | The EMS is the only writer to the battery command topic. |

**Cost:** Same container as ingestion service (combine into one) → no additional cost. Or separate at ~€5/month.

#### Step 5 — Blockchain settlement

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Chain** | **Base** | Polygon, Arbitrum, Gnosis Chain | Base has very low fees (~€0.001 per tx), strong Coinbase ecosystem, and excellent tooling. |
| **RPC provider** | **Base public RPC** for reads, **Alchemy** or **Coinbase Developer Platform** for writes | Infura, Ankr, QuickNode, dRPC | Public RPCs are fine for reads. Use a paid provider for write reliability (tx submission). Alchemy has a generous Base free tier. |
| **Backend wallet** | **ethers.js** Wallet with private key stored in environment variable | AWS KMS signer, Fireblocks | For a single community backend, a hot wallet is fine. For production with many communities, use KMS-backed signing. |
| **Gas management** | Pre-fund the backend wallet with ETH on Base | Relay service / meta-transactions | At ~€0.001 per tx, 96 tx/day ≈ €0.10/day ≈ €3/month gas. |
| **Tx confirmation** | Wait for 1 block confirmation, update `settlement_batches.status` to `confirmed` | — | If tx fails, update status to `failed` and alert. The `ensureZeroSum` modifier means invalid data can never be recorded on-chain. |
| **Contract deployment** | Use **Hardhat** (already in the repo) | Foundry | `EnergyPPAImplementation.sol` is already deployed via Hardhat + OpenZeppelin UUPS proxy. |
| **Event indexing** | **TheGraph** subgraph for historical queries and dashboards | Dune Analytics, or index events into PostgreSQL via a custom indexer | TheGraph gives a GraphQL API over all on-chain events. Useful for the community dashboard. |

**Cost:** Gas ~€3/month. RPC provider free tier. TheGraph hosted service free for small subgraphs.

#### Step 6 — Debt settlement (EURC)

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Stablecoin** | **EURC** (Circle) on Base | EURe (Monerium), USDC (if EUR not required) | EURC is natively issued by Circle on Base. Strong liquidity and first-class support. |
| **Member wallet** | Community **web app** with embedded wallet (e.g. Privy, Dynamic, or Safe{Wallet}) | MetaMask, other browser wallets | Embedded wallets reduce onboarding friction — members don't need to install MetaMask. |
| **Payment UI** | Community dApp shows balance, "Pay debt" button triggers `approve()` + `settleOwnDebt()` | — | Two transactions from the user's perspective: approve EURC spending, then settle. Can be combined into one click with a permit signature (ERC-2612) if EURC supports it. |
| **Treasury** | **Safe (multisig)** for community treasury | Single EOA | A 2-of-3 multisig protects community funds. The community fee accumulates here. |

**Cost:** Transaction fees only (~€0.001 per settlement).

### Monitoring and dashboards

| Concern | Recommendation | Alternative | Notes |
|---|---|---|---|
| **Operational dashboard** | **Grafana** connected to TimescaleDB + PostgreSQL | Metabase, custom React dashboard | Grafana has native TimescaleDB support. Show: meter health (reading_count gaps), interval summaries, settlement status. |
| **Member-facing dashboard** | Custom **Next.js** app (already in this monorepo) | — | Show balances, billing history, energy breakdown per source. Read from TheGraph subgraph + PostgreSQL. |
| **Alerting** | Grafana alerts → Slack / email | PagerDuty, Opsgenie | Alert on: missing meter readings, failed settlements, zero-sum violations, low gas balance. |

**Cost:** Grafana Cloud free tier (3 users, 10k metrics). Self-hosted Grafana free.

### Recommended stack summary

| Component | Service | Monthly cost |
|---|---|---|
| MQTT broker | HiveMQ Cloud (free tier) or Mosquitto on VPS | €0 – €5 |
| Ingestion service | Node.js on Railway / Fly.io | €5 |
| Time-series database | Timescale Cloud (Starter) | €30 |
| Aggregation scheduler | pg_cron (inside TimescaleDB) | €0 (included) |
| EMS backend | Node.js on Railway / Fly.io (same container or separate) | €0 – €5 |
| Settlement database | PostgreSQL (included in Timescale Cloud or separate) | €0 – €10 |
| Blockchain | Base | €3 (gas) |
| RPC provider | Alchemy / public RPC | €0 |
| Event indexer | TheGraph hosted | €0 |
| Stablecoin | EURC on Base | tx fees only |
| Dashboard | Grafana Cloud (free tier) | €0 |
| Member wallets | Privy / Dynamic embedded wallets | €0 – €50 |
| Treasury | Safe multisig | €0 |

**Total estimated infrastructure cost: €38 – €108/month** for a small community (< 50 members, 10 meters).

### Scaling notes

- **10–50 members:** The stack above handles this without changes. TimescaleDB Starter is more than sufficient.
- **50–500 members:** Move to Timescale Cloud Pro (~€100/month). Consider splitting the ingestion service and EMS into separate containers. Add a Redis cache for ownership config.
- **500+ members / multiple communities:** Add a message queue (NATS or RabbitMQ) between MQTT and ingestion. Shard TimescaleDB by community_id. Move to a dedicated PostgreSQL for settlement_batches. Consider batch settlement transactions (one tx per community per interval, but multiple communities per block).
- **Battery optimization:** For advanced battery scheduling (day-ahead forecasting, market arbitrage), add a separate **optimization service** that runs ML models and writes charge/discharge schedules. The EMS reads the schedule and sends commands. This can be a Python service with access to weather APIs and spot market data.
