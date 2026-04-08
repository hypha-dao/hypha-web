# Energy Community System — Simple Guide

How energy data travels from your smart meter to your final bill, step by step.

---

## The Community

```
           ┌─────────────────────────────────┐
           │          ELECTRICITY GRID        │
           │         (energy retailer)        │
           └────────────────┬────────────────┘
                            │
                     Grid connection
                            │
     ┌──────────────────────┼──────────────────────┐
     │               Community Bus                  │
     │          (shared wire connecting all)         │
     ├──────┬──────┬──────┬──────────┬──────────────┤
     │      │      │      │          │              │
   Alice   Bob   Carol  Solar Park  Battery       Grid
                                                  meter
```

- 3 households: Alice, Bob, Carol (they consume electricity)
- 1 investor: Dave (owns shares but doesn't consume — no physical meter)
- 1 solar park: produces electricity for the community
- 1 battery: stores excess solar energy for later use
- Grid connection: imports electricity when solar + battery aren't enough

Each source has its own ownership structure:

| Member | Solar Park | Battery |
|--------|-----------|---------|
| Alice  | 30%       | —       |
| Bob    | 30%       | 50%     |
| Carol  | 20%       | —       |
| Dave   | 20%       | 50%     |

Your ownership % in a source determines your share of cheap energy from that source and your share of its revenue. Alice and Carol invested only in solar. Bob and Dave invested in both solar and battery.

---

## The 6 Steps

### Step 1 — Smart meters send readings

**What happens:** Every smart meter measures how much electricity flows through it and sends a small message every 10 seconds.

**Simple example:** At 2:05 PM, Alice's meter sees she's using 1.2 kW of power. The solar park meter sees it's producing 6.0 kW. The battery is idle. These numbers are sent as small messages over the internet.

**Technology:**
- Protocol: **MQTT** (a lightweight messaging system designed for devices)
- Broker: **Mosquitto** or **HiveMQ Cloud** (the "post office" that receives and forwards messages)
- Security: Encrypted connection (TLS), each meter has its own login

**Where the data lives:** Nowhere permanently. The messages exist briefly in the MQTT broker's memory, like a phone call — once delivered, they're gone.

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

---

### Step 2 — Messages are saved to a database

**What happens:** A small program (the "ingestion service") listens to all the meter messages and saves them into a database. It also checks for duplicates and bad data.

**Simple example:** Every 10 seconds, a new row is added to the database:

```
Time          │ Meter    │ Reading
──────────────┼──────────┼─────────
14:05:00      │ Alice    │ using 1.2 kW
14:05:00      │ Solar    │ producing 6.0 kW
14:05:00      │ Battery  │ idle
14:05:10      │ Alice    │ using 1.1 kW
14:05:10      │ Solar    │ producing 5.9 kW
...
```

**Technology:**
- Database: **TimescaleDB** (PostgreSQL with a time-series plugin, good for sensor data)
- Cloud options: **Timescale Cloud**, **AWS RDS with TimescaleDB**, or **InfluxDB Cloud**
- Ingestion service: A small **Node.js** or **Python** program

**Where the data lives:** TimescaleDB, table called `raw_readings`. Kept for 90 days, then automatically deleted (too much data to keep forever — one meter produces 8,640 readings per day).

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

---

### Step 3 — Every 15 minutes: summarize the readings

**What happens:** A scheduled job runs every 15 minutes (at :00, :15, :30, :45). It looks at all the raw readings from the past 15 minutes and calculates one summary number per meter: how many kWh were produced or consumed in that window.

**Simple example (14:00–14:15 interval):**

```
Meter        │ 15-min total  │ Meaning
─────────────┼───────────────┼────────────────────
Alice        │ 2.0 kWh used  │ Alice consumed 2.0 kWh
Bob          │ 4.0 kWh used  │ Bob consumed 4.0 kWh
Carol        │ 1.0 kWh used  │ Carol consumed 1.0 kWh
Solar park   │ 4.0 kWh made  │ Solar produced 4.0 kWh
Battery      │ 2.0 kWh out   │ Battery discharged 2.0 kWh
Grid         │ 1.0 kWh in    │ Imported 1.0 kWh from grid
```

**Check:** Production (4.0 solar + 2.0 battery) = 6.0 kWh. Consumption (2.0 + 4.0 + 1.0) = 7.0 kWh. Shortfall: 1.0 kWh from grid.

**Technology:**
- Same database: **TimescaleDB** (a scheduled query aggregates the raw data)
- Scheduler: **pg_cron** (built into PostgreSQL) or a simple **cron job**

**Where the data lives:** TimescaleDB, table called `interval_readings`. Kept forever — this is the official record of what happened.

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
  { "meter_id": "meter-bob-001",     "energy_wh": 4000, "direction": "consumption" },
  { "meter_id": "meter-carol-001",   "energy_wh": 1000, "direction": "consumption" },
  { "meter_id": "meter-solar-001",   "energy_wh": 4000, "direction": "production"  },
  { "meter_id": "meter-battery-001", "energy_wh": 2000, "direction": "production"  },
  { "meter_id": "meter-grid-001",    "energy_wh": 1000, "direction": "import"      }
]
```

---

### Step 4 — The EMS backend calculates who pays what

This is the brain of the system. The EMS (Energy Management System) is a backend program that takes the 15-minute summaries, looks at the community's rules, and figures out the fair split.

**What it reads:**

| Data | Where it comes from |
|---|---|
| How much each household consumed | `interval_readings` database (Step 3) |
| How much solar was produced | `interval_readings` database (Step 3) |
| Each member's ownership % (per source) | The blockchain contract |
| The price catalogue (see below) | Community configuration |

**The price catalogue:**

These are the prices that apply to different energy flows within the community. They are set when the community is configured and can be updated through governance.

| Price | What it means | Example value | How it's calculated |
|---|---|---|---|
| **CommunityGenerationPrice** | Price per kWh for solar energy shared with members | 8 ct/kWh | Weighted average of all community generation costs |
| **CommunityRetailerImportPrice** | Price per kWh when community buys from the grid | 25 ct/kWh | Retailer tariff or spot market price |
| **CommunityRetailerExportPrice** | Price per kWh when community sells surplus to grid | 5 ct/kWh | Retailer feed-in tariff or spot market price |
| **CommunityBatteryChargePrice** | Extra cost per kWh for charging the battery | 1 ct/kWh | Storage costs on top of CommunityGenerationPrice |
| **CommunityBatteryDischargePrice** | Extra cost per kWh for discharging the battery | 1 ct/kWh | Storage costs on top of CommunityGenerationPrice |

For members who also have their own rooftop solar (prosumers), additional prices apply:

| Price | What it means | Example value |
|---|---|---|
| **ProsumerCommunityPrice** | Price when a prosumer shares their own energy with the community | 8 ct/kWh |
| **ProsumerRetailerImportPrice** | Price when a prosumer buys from the grid directly | 25 ct/kWh |
| **ProsumerRetailerExportPrice** | Price when a prosumer sells to the grid directly | 5 ct/kWh |
| **ProsumerBatteryChargePrice** | Extra cost for a prosumer to charge the community battery | 1 ct/kWh |
| **ProsumerBatteryDischargePrice** | Extra cost for a prosumer to use battery energy | 1 ct/kWh |

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
        { "member": "0xCarol...", "ownershipBps": 2000 },
        { "member": "0xDave...",  "ownershipBps": 2000 }
      ]
    },
    {
      "sourceId": "battery-001",
      "sourceType": "BATTERY",
      "priceCt": 15,
      "owners": [
        { "member": "0xBob...",  "ownershipBps": 5000 },
        { "member": "0xDave...", "ownershipBps": 5000 }
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

**Formal algorithm definitions:**

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

**The calculation (three simple passes):**

Using the same interval from Step 3:

```
Solar produced: 4.0 kWh (at CommunityGenerationPrice = 8 ct/kWh)
Battery discharged: 2.0 kWh (at 15 ct/kWh)
Alice consumed: 2.0 kWh
Bob consumed: 4.0 kWh
Carol consumed: 1.0 kWh
Total consumed: 7.0 kWh
Total local: 4.0 + 2.0 = 6.0 kWh
Shortfall: 7.0 - 6.0 = 1.0 kWh must come from grid (at CommunityRetailerImportPrice = 25 ct/kWh)
```

**Pass 1 — Each member gets their ownership share of each source.**

Each source uses its own ownership percentages. Cheapest source first (solar before battery).

```
                     Solar share   Battery share   Total    Needs     Covered?
Alice (30%S,  0%B):  1.2 kWh       —              1.2      2.0 kWh   No → 0.8 short
Bob   (30%S, 50%B):  1.2 kWh       1.0 kWh        2.2      4.0 kWh   No → 1.8 short
Carol (20%S,  0%B):  0.8 kWh       —              0.8      1.0 kWh   No → 0.2 short
Dave  (20%S, 50%B):  0.8 kWh       1.0 kWh        1.8      0.0 kWh   Yes → 1.8 surplus
```

(Dave is an investor — he owns 20% solar + 50% battery but doesn't consume. His share goes to surplus.)

**Pass 2 — Leftover goes to members who need more (split by source ownership).**

Each source's surplus is redistributed separately, using that source's ownership percentages.

Solar surplus from Dave: 0.8 kWh at 8 ct/kWh.

```
Members who need more solar: Alice (30%), Bob (30%), Carol (20%)
Their combined solar ownership: 30 + 30 + 20 = 80%

Alice gets: 0.8 × (30/80) = 0.30 kWh extra solar
Bob gets:   0.8 × (30/80) = 0.30 kWh extra solar
Carol gets: 0.8 × (20/80) = 0.20 kWh extra solar  ← exactly covers Carol

Updated shortfalls:
  Alice: 0.8 - 0.3 = 0.5 kWh still needed
  Bob:   1.8 - 0.3 = 1.5 kWh still needed
```

Battery surplus from Dave: 1.0 kWh at 15 ct/kWh.

```
Members who need more AND own battery: Bob (50%)
Alice has 0% battery ownership — she cannot receive battery surplus.

Bob gets: 1.0 × (50/50) = 1.0 kWh extra battery

Updated shortfalls:
  Alice: 0.5 kWh still needed
  Bob:   1.5 - 1.0 = 0.5 kWh still needed
```

**Pass 3 — Whatever's left comes from the grid.**

```
Alice still needs 0.5 kWh → imported from grid at 25 ct/kWh
Bob still needs 0.5 kWh → imported from grid at 25 ct/kWh
Total grid import: 1.0 kWh
```

**Final bills for this 15-minute interval:**

```
                Solar kWh    Solar cost     Batt. kWh   Batt. cost    Grid kWh    Grid cost     Total cost
Alice:          1.5          12.0 ct        0.0         0.0 ct        0.5         12.5 ct       24.5 ct
Bob:            1.5          12.0 ct        2.0         30.0 ct       0.5         12.5 ct       54.5 ct
Carol:          1.0           8.0 ct        0.0          0.0 ct       0.0          0.0 ct        8.0 ct
Dave:           0.0           0.0 ct        0.0          0.0 ct       0.0          0.0 ct        0.0 ct
                ─────        ──────         ─────       ──────        ─────       ──────        ──────
Total:          4.0 kWh      32.0 ct        2.0 kWh    30.0 ct       1.0 kWh    25.0 ct       87.0 ct
```

Check: 4.0 × 8 + 2.0 × 15 + 1.0 × 25 = 32 + 30 + 25 = 87 ct. Correct.

Alice pays solar (8 ct) and grid (25 ct) — she has no battery ownership so she can't receive battery energy. Bob pays all three: solar, battery, and grid. Carol is fully covered by solar. Dave pays nothing because he consumed nothing (but he'll earn revenue from both sources on-chain).

**Technology:**
- Backend: **Node.js** or **Python** service
- Cloud options: **AWS Lambda**, **Google Cloud Functions**, or a simple **Docker container**
- Scheduling: Runs immediately after Step 3 completes

**Where the data lives:** The EMS saves its calculation to PostgreSQL, table called `settlement_batches`. This is the receipt — it records exactly what was sent to the blockchain and why.

**Output — settlement entries (saved to PostgreSQL, then sent to blockchain):**

```json
{
  "intervalStart": "2025-01-15T14:00:00Z",
  "intervalEnd": "2025-01-15T14:15:00Z",
  "communityId": "community-001",
  "entries": [
    { "deviceId": 1001, "amountWh": 1500, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 1001, "amountWh": 500,  "priceCt": 25, "source": "IMPORT"  },
    { "deviceId": 2001, "amountWh": 1500, "priceCt": 8,  "source": "LOCAL"   },
    { "deviceId": 2001, "amountWh": 2000, "priceCt": 15, "source": "BATTERY" },
    { "deviceId": 2001, "amountWh": 500,  "priceCt": 25, "source": "IMPORT"  },
    { "deviceId": 3001, "amountWh": 1000, "priceCt": 8,  "source": "LOCAL"   }
  ],
  "txHash": null,
  "status": "pending"
}
```

Device 1001 = Alice, 2001 = Bob, 3001 = Carol. Dave has no device (investor).

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

---

### Step 5 — The blockchain records the settlement

**What happens:** The EMS backend sends one transaction to the smart contract on the blockchain. The contract does the financial accounting: charge each consumer, collect fees, distribute revenue to each source's owners.

**What the backend sends:**

```
consumeEnergy([
  { device: Alice,  amount: 1.5 kWh, price: 8 ct,  source: LOCAL   },
  { device: Alice,  amount: 0.5 kWh, price: 25 ct, source: IMPORT  },
  { device: Bob,    amount: 1.5 kWh, price: 8 ct,  source: LOCAL   },
  { device: Bob,    amount: 2.0 kWh, price: 15 ct, source: BATTERY },
  { device: Bob,    amount: 0.5 kWh, price: 25 ct, source: IMPORT  },
  { device: Carol,  amount: 1.0 kWh, price: 8 ct,  source: LOCAL   },
])
```

**What the contract does:**

Step A — Charge each consumer:

```
Alice is charged: 1.5 × 8 + 0.5 × 25 = 12.0 + 12.5 = 24.5 ct
Bob is charged:   1.5 × 8 + 2.0 × 15 + 0.5 × 25 = 12.0 + 30.0 + 12.5 = 54.5 ct
Carol is charged: 1.0 × 8 = 8.0 ct
```

Step B — Split revenue per source among fees and that source's owners:

```
Solar revenue (LOCAL): 12.0 + 12.0 + 8.0 = 32.0 ct

Community fee (5%):   32 × 5%  = 1.60 ct  → community treasury
Aggregator fee (3%):  32 × 3%  = 0.96 ct → Hypha Energy (the operator)
Remaining for solar owners: 32 - 1.60 - 0.96 = 29.44 ct

  Alice (30%): 29.44 × 30% =  8.83 ct earned
  Bob   (30%): 29.44 × 30% =  8.83 ct earned
  Carol (20%): 29.44 × 20% =  5.89 ct earned
  Dave  (20%): 29.44 × 20% =  5.89 ct earned
```

```
Battery revenue (BATTERY): 30.0 ct

Community fee (5%):   30 × 5%  = 1.50 ct
Aggregator fee (3%):  30 × 3%  = 0.90 ct
Remaining for battery owners: 30 - 1.50 - 0.90 = 27.60 ct

  Bob  (50%): 27.60 × 50% = 13.80 ct earned
  Dave (50%): 27.60 × 50% = 13.80 ct earned
```

Alice and Carol earn nothing from battery — they have 0% battery ownership.

Step C — Net balance (what each member owes or is owed):

```
              Charged    Earned     Net
Alice:        -24.50     +8.83      -15.67 ct (owes 15.67 ct)
Bob:          -54.50     +22.63     -31.87 ct (owes 31.87 ct)
Carol:         -8.00     +5.89      -2.11 ct  (owes 2.11 ct)
Dave:           0.00     +19.69     +19.69 ct (earns 19.69 ct)
Community:      —        +3.10      +3.10 ct
Aggregator:     —        +1.86      +1.86 ct
Import:         —          —        +25.00 ct

Total: -15.67 - 31.87 - 2.11 + 19.69 + 3.10 + 1.86 + 25.00 = 0.00  ✓
```

Everything sums to zero. The contract verifies this — if it doesn't balance, the transaction is rejected.

**Solidity interface (from `IEnergyPPA.sol`):**

The current contract defines these types. The EMS backend constructs an array of `ConsumptionReading` and calls `consumeEnergy()`.

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

> **Note:** The current contract has a single `ownershipBps` per member and only `LOCAL`/`IMPORT` source types. The per-source ownership model described in this document (separate solar vs battery ownership, `BATTERY` source type) requires extending the contract. The `EnergyDistributionImplementation.sol` already supports multiple source types via `EnergySource[]`.

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
event EnergyExported(uint256 quantity, uint256 revenue);  // for export intervals
```

**Balance representation:**

| Balance state | Storage | Visible as |
|---|---|---|
| Positive (credit) | `EnergyToken.balanceOf(member)` | ERC-20 token in any wallet |
| Negative (debt) | `cashCreditBalances[member]` (int256) | Debt shown in community dApp |
| Zero | Nothing stored | — |

The contract uses a dual representation: positive balances are ERC-20 tokens (transferable, visible in wallets), while negative balances are internal int256 mappings.

**Technology:**
- Blockchain: **Gnosis Chain** (low fees, euro-friendly) or **Base** / **Polygon**
- Contract: `EnergyPPAImplementation.sol` (already built)
- Backend wallet: The EMS has an Ethereum wallet that is whitelisted to call the contract

**Where the data lives:** On the blockchain permanently. Balances are stored in the smart contract. Events (logs of what happened) are stored in the blockchain's transaction history. Positive balances (like Dave's +19.69 ct) become **EnergyToken** (an ERC-20 token visible in any crypto wallet).

---

### Step 6 — Members settle their debts with real money

**What happens:** Members who owe money (negative balance) pay with digital euros (EURC stablecoin). Members who earned money (positive balance) can hold their credits or cash them out.

**Simple example:**

After many 15-minute intervals, Bob has accumulated -€15.20 of debt. He pays:

1. Bob opens the community app (or any crypto wallet)
2. He approves a payment of 15.20 EURC
3. He clicks "Settle my debt"
4. The smart contract receives his EURC, reduces his debt to €0.00, and forwards the EURC to the community treasury

Carol has accumulated +€3.50 in credits. She can:
- Keep them (they're EnergyTokens in her wallet)
- Use them to offset future consumption
- Transfer them to another member

**Technology:**
- Stablecoin: **EURC** (Circle's euro stablecoin) or **EURe** (Monerium's euro stablecoin)
- Wallet: **MetaMask**, **Safe (multisig)**, or the community's own app
- Contract function: `settleOwnDebt(amount)` or `settleDebt(debtor, amount)`

**Where the data lives:** On the blockchain. The EURC transfer and the balance update are both recorded permanently.

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

Example: Bob owes 31.87 ct (internal balance = -3187)
  EURC needed = 3187 × 10000 = 31,870,000 base units = 31.87 EURC
```

**Settlement flow (two ERC-20 transactions):**

```
1. Bob calls:  EURC.approve(settlementContract, 31870000)
2. Bob calls:  EnergySettlement.settleOwnDebt(31870000)

Inside the contract:
   a. energySystemAmount = 31870000 / 10000 = 3187
   b. debt = abs(balance[Bob]) = 3187
   c. settle = min(3187, 3187) = 3187
   d. EURC.transferFrom(Bob → contract → paymentRecipient)
   e. balance[Bob] += 3187  →  balance[Bob] = 0
   f. settledBalance -= 3187  (tracks external money entering system)
```

**Events emitted:**

```solidity
event DebtSettled(
    address indexed payer,
    address indexed debtor,
    uint256 eurcAmount,          // EURC transferred (6 decimals)
    int256  previousBalance,     // balance before settlement
    int256  newBalance           // balance after settlement
);
```

---

## Where everything lives — summary

```
Step 1: Smart meters → MQTT broker (in memory, temporary)
Step 2: MQTT → TimescaleDB "raw_readings" (kept 90 days)
Step 3: Aggregation → TimescaleDB "interval_readings" (kept forever)
Step 4: EMS calculation → PostgreSQL "settlement_batches" (kept forever)
Step 5: Blockchain settlement → Smart contract state + events (permanent)
Step 6: Debt payment → EURC transfers on blockchain (permanent)
```

```
┌───────────────────────────────────────────────────────────┐
│                    TEMPORARY                               │
│  MQTT Broker (messages disappear after delivery)          │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│                    SHORT-TERM (90 days)                    │
│  TimescaleDB: raw_readings                                │
│  Every 10-second meter reading                            │
│  ~52,000 rows per day for 6 meters                        │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│                    LONG-TERM (forever)                     │
│  TimescaleDB: interval_readings                           │
│  One row per meter per 15 minutes                         │
│  ~580 rows per day for 6 meters                           │
│                                                           │
│  PostgreSQL: settlement_batches                            │
│  One row per 15-minute settlement                         │
│  ~96 rows per day                                         │
└─────────────────────────┬─────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────┐
│                    PERMANENT (blockchain)                  │
│  Smart contract: member balances, fees, ownership         │
│  EnergyToken: positive credit balances (ERC-20)           │
│  Events: full log of every settlement                     │
│  EURC: stablecoin payment records                         │
└───────────────────────────────────────────────────────────┘
```

---

## Suggested technology stack

| Component | Recommendation | Alternative | Monthly cost estimate |
|---|---|---|---|
| MQTT broker | **Mosquitto** (self-hosted) | HiveMQ Cloud | Free – €20 |
| Time-series database | **Timescale Cloud** | InfluxDB Cloud, AWS Timestream | €30 – €100 |
| Backend / EMS | **Node.js** on Docker | Python, hosted on AWS/GCP | €20 – €50 |
| Scheduler | **pg_cron** (inside TimescaleDB) | AWS EventBridge, cron | Free |
| Blockchain | **Gnosis Chain** | Base, Polygon, Arbitrum | Gas fees: €5 – €30/month |
| Stablecoin | **EURC** (Circle) | EURe (Monerium) | Transaction fees only |
| Dashboard | **Grafana** + PostgreSQL | Custom React app | Free – €20 |
| Wallet interface | **Safe (multisig)** for treasury | MetaMask, custom dApp | Free |

Total estimated infrastructure cost: **€75 – €220/month** for a small community.

---

## What is calculated where — cheat sheet

| Calculation | Where | Why there |
|---|---|---|
| "Alice used 2.0 kWh this interval" | **TimescaleDB** (Step 3) | Summing 90 raw readings is a database job |
| "Alice's solar share is 1.2 kWh" | **Backend EMS** (Step 4) | Needs per-source ownership % from blockchain + meter data from database |
| "Alice pays 8 ct for solar + 25 ct for grid, Bob pays solar + battery + grid" | **Backend EMS** (Step 4) | Needs the price catalogue + the three-pass algorithm |
| "Charge Alice 24.5 ct, credit her 8.83 ct" | **Blockchain** (Step 5) | Financial settlement must be tamper-proof |
| "Community gets 5% fee = 1.60 ct (solar) + 1.50 ct (battery)" | **Blockchain** (Step 5) | Fee split is enforced by the smart contract |
| "All balances sum to zero" | **Blockchain** (Step 5) | The contract rejects the transaction if it doesn't balance |
| "Bob pays 15.20 EURC to clear his debt" | **Blockchain** (Step 6) | Real money movement must be on a public ledger |
