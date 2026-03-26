# Energy Community — End-to-End Data Flow

From smart meter readings to blockchain settlement: every stage, every database, every message.

---

## Physical Topology

```
                        ┌──────────────┐
                        │   GRID       │
                        │  (utility)   │
                        └──────┬───────┘
                               │
                          device 601 (import meter)
                          device 901 (export meter)
                               │
              ┌────────────────┼────────────────┐
              │          Community Bus           │
              │  (low-voltage distribution)      │
              ├────────────────┬────────────────┤
              │                │                │
         device 101       device 201       device 301
        ┌─────────┐      ┌─────────┐      ┌─────────┐
        │  Alice  │      │   Bob   │      │  Carol  │
        │  40%    │      │  40%    │      │  20%    │
        └─────────┘      └─────────┘      └─────────┘

              │                                 │
         device 401                        device 501
        ┌─────────────┐                  ┌─────────────┐
        │  Solar Park │                  │   Battery   │
        │  (50 kWp)   │                  │  (30 kWh)   │
        └─────────────┘                  └─────────────┘
```

| Asset | Device ID | Meter type | What it measures |
|---|---|---|---|
| Alice's house | 101 | Import only | Energy consumed from the community bus |
| Bob's house | 201 | Import only | Energy consumed from the community bus |
| Carol's house | 301 | Import only | Energy consumed from the community bus |
| Solar park | 401 | Production | Active power generation (kWh fed into the bus) |
| Battery | 501 | Bidirectional | Charge (drawing from bus) and discharge (feeding bus) |
| Grid import | 601 | Import only | Energy drawn from the utility grid into the bus |
| Grid export | 901 | Export only | Surplus energy sold from the bus back to grid |

The households are pure consumers in this setup — they don't have their own solar panels. All production comes from the shared solar park. The battery stores and releases community energy. The grid absorbs any mismatch.

Ownership: Alice 40%, Bob 40%, Carol 20% — these basis points govern both energy allocation and revenue split.

---

## The Key Insight: Meters Don't Decide — They Only Measure

This is the most important concept in the entire system. People often ask: "How does Alice's meter know whether her electricity came from the solar park, the battery, or the grid?" The answer: **it doesn't. And it doesn't need to.**

### Electricity is fungible on a shared bus

All assets — households, solar park, battery, grid — are connected to the same low-voltage community bus (a shared wire). Electrons don't have labels. When Alice's kettle draws 2 kW, the current flows from whatever source is feeding the bus at that instant. Physically, it's a mix of everything.

```
        Solar Park          Battery           Grid
        (producing)        (discharging)     (importing)
            │                  │                 │
            ▼                  ▼                 ▼
    ════════════════════════════════════════════════════  ← Community Bus
            │                  │                 │         (shared wire)
            ▼                  ▼                 ▼
          Alice              Bob              Carol
        (consuming)        (consuming)       (consuming)
```

Alice's meter sees **one number**: how many Wh flowed into her house during a time window. It has no concept of "solar kWh" vs. "battery kWh" vs. "grid kWh". That distinction is purely an accounting construct applied after the fact.

### Three separate layers

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: PHYSICS (real-time, continuous)                        │
│                                                                 │
│ Energy flows according to physics, not software:                │
│   • Solar inverter: always on, produces whatever the sun gives  │
│   • Battery: EMS sends charge/discharge commands via MQTT       │
│     (this is the ONLY physical action the EMS takes)            │
│   • Grid: absorbs the mismatch automatically (Kirchhoff's law) │
│   • Households: draw whatever they need from the shared bus     │
│                                                                 │
│ Meters on every asset measure what actually happened.           │
│ Nothing is "routed" — physics routes itself.                    │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: METERING (every 10 seconds, factual)                  │
│                                                                 │
│ Each meter reports one cumulative number:                       │
│   • Alice meter 101: imported 3,000 Wh this interval           │
│   • Solar meter 401: exported 8,000 Wh this interval           │
│   • Battery meter 501: imported 500 Wh (charging)              │
│   • Grid meter 601: imported 500 Wh from utility               │
│                                                                 │
│ These are facts. No interpretation yet.                         │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: ACCOUNTING (every 15 minutes, computed)                │
│                                                                 │
│ The EMS applies ownership rules + merit-order to attribute      │
│ each household's consumption to a source and a price:           │
│   • Alice's 3.0 kWh → "3.0 kWh LOCAL at 10¢" (her solar share)│
│   • Bob's 4.5 kWh → "4.0 kWh LOCAL at 10¢ + 0.5 kWh IMPORT   │
│     at 25¢" (solar share + grid)                                │
│                                                                 │
│ This attribution is what the contract receives.                 │
│ The contract never sees raw meter data — only the EMS's         │
│ computed ConsumptionReading[] array.                             │
└─────────────────────────────────────────────────────────────────┘
```

### Who decides what: EMS vs. Meter vs. Contract

| Question | Who answers | How |
|---|---|---|
| Should the battery charge or discharge right now? | **EMS** (real-time control) | Sends MQTT command to battery BMS based on solar forecast, prices, SoC |
| How much energy did Alice actually consume? | **Meter** (measurement) | Reads cumulative Wh register, computes delta |
| How much grid import was needed? | **Grid meter** (measurement) | The grid absorbs whatever local production doesn't cover — this is automatic |
| What source should Alice's kWh be attributed to? | **EMS** (accounting logic) | Runs merit-order: allocate solar share first, then battery, then grid |
| What price does Alice pay per kWh? | **EMS** (pricing logic) | LOCAL price for solar/battery share, IMPORT price for grid energy |
| Is the final accounting fair and correct? | **Contract** (on-chain enforcement) | Verifies zero-sum, splits revenue by ownership %, enforces fee structure |

### Walk-through: What actually happens at 14:05 when Alice boils her kettle

```
14:05:00  PHYSICS
          Alice's kettle draws 2 kW.
          At this exact moment, the solar park is producing 6 kW,
          the battery is discharging 1 kW, and Bob + Carol draw 4 kW.
          Total supply (6 + 1 = 7 kW) > total demand (2 + 4 = 6 kW).
          The surplus 1 kW flows to the grid (automatic, no decision needed).
          Alice's meter sees 2 kW flowing in. It doesn't know or care where from.

14:05:10  METERING
          Alice's meter (device 101) publishes via MQTT:
            { activeImportWh: 523405 }   ← cumulative register ticked up
          Solar meter (device 401) publishes:
            { activeExportWh: 1045020 }
          Battery meter (device 501) publishes:
            { activeExportWh: 98760 }     ← discharging
          Grid meter (device 901) publishes:
            { activeExportWh: 240015 }    ← surplus leaving to grid

14:15:00  ACCOUNTING (end of 15-min interval)
          Aggregation service sums up the interval:
            Alice consumed 3.0 kWh total
            Solar produced 8.0 kWh total
            Battery discharged 0.5 kWh net (discharged for a while, then charged)
            Grid exported 0.0 kWh, imported 0.5 kWh

          EMS runs merit-order:
            Alice's solar share: 40% × 8.0 = 3.2 kWh available
            Alice only needs 3.0 kWh → fully covered by her solar share
            → ConsumptionReading: { device:101, qty:30, price:10, source:LOCAL }

          The EMS does NOT say "these specific electrons came from the solar park."
          It says: "Given total production and Alice's ownership share,
                    her consumption is fully attributable to local sources."
```

### Why the EMS controls the battery but not the energy "routing"

The EMS has two separate jobs:

**Job 1: Real-time control (physics).** The EMS decides whether to charge or discharge the battery based on:
- Current solar production (is there surplus?)
- Current consumption (is demand exceeding production?)
- Battery SoC (is it full? nearly empty?)
- Grid prices (is import expensive right now? store energy for later)
- Solar forecast (will there be more production later?)

This is a real physical action — the EMS sends a command to the battery's BMS.

**Job 2: Post-interval accounting (finance).** After the 15-minute interval ends, the EMS looks at what actually happened (from meter readings) and decides how to attribute it financially. This is where ownership percentages, prices, and source labels come in.

These two jobs are **independent**. The battery control happens in real-time (every few seconds). The accounting happens after the fact (every 15 minutes). The battery might have charged for 5 minutes and discharged for 10 minutes during one interval — the meter captures the net result, and the EMS uses that net number for accounting.

### What the contract sees

The contract is completely unaware of meters, MQTT, batteries, or solar panels. It receives a simple array:

```
consumeEnergy([
  { deviceId: 101, quantity: 30, pricePerKwh: 10, source: LOCAL  },
  { deviceId: 201, quantity: 40, pricePerKwh: 10, source: LOCAL  },
  { deviceId: 201, quantity:  5, pricePerKwh: 25, source: IMPORT },
  { deviceId: 301, quantity: 10, pricePerKwh: 10, source: LOCAL  },
])
```

The contract trusts the EMS (whitelisted backend) to have computed these numbers correctly from the meter data. The contract's job is purely financial: debit consumers, split revenue, verify zero-sum.

The on-chain parameters (ownership %, fees, export price) serve as the **rules** that the EMS must follow when computing the attribution. They are the "constitution" — the EMS is the "executive" that applies the rules to the real-world data.

---

## The 7 Stages

```
 STAGE 1          STAGE 2           STAGE 3            STAGE 4
 ┌────────┐      ┌────────────┐    ┌──────────────┐   ┌───────────────┐
 │ Smart  │ MQTT │ Ingestion  │    │  Aggregation │   │     EMS       │
 │ Meters │─────►│  Service   │───►│  (15-min)    │──►│  Attribution  │
 │        │      │            │    │              │   │  Algorithm    │
 └────────┘      └─────┬──────┘    └──────┬───────┘   └───────┬───────┘
                       │                  │                    │
                       ▼                  ▼                    ▼
                 ┌───────────┐     ┌────────────┐      ┌──────────────┐
                 │TimescaleDB│     │TimescaleDB │      │  PostgreSQL  │
                 │raw_readings│    │interval_   │      │ settlement_  │
                 │           │     │readings    │      │ batches      │
                 └───────────┘     └────────────┘      └──────┬───────┘
                                                              │
 STAGE 7          STAGE 6           STAGE 5                   │
 ┌────────────┐  ┌──────────────┐  ┌───────────────┐         │
 │ Stablecoin │  │  Event       │  │  Blockchain   │◄────────┘
 │ Settlement │  │  Indexer     │  │  consumeEnergy│
 │ (EURC)     │◄─┤  / Subgraph │◄─┤  on-chain tx  │
 └────────────┘  └──────┬───────┘  └───────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │  PostgreSQL  │
                 │ on_chain_    │
                 │ events       │──► Dashboard / API
                 └──────────────┘
```

---

## Stage 1 — Smart Meters → MQTT Broker

### What happens

Every physical meter publishes its reading to an MQTT broker over TLS. Meters use the P1/P4 port (Dutch/EU DSMR standard) or a Modbus-to-MQTT gateway for inverters and batteries.

### MQTT topic structure

```
community/{communityId}/meter/{deviceId}/reading
```

Examples:
```
community/amsterdam-01/meter/101/reading    ← Alice's house
community/amsterdam-01/meter/401/reading    ← Solar park
community/amsterdam-01/meter/501/reading    ← Battery
community/amsterdam-01/meter/601/reading    ← Grid import
```

### Payload (JSON)

```json
{
  "deviceId": 101,
  "timestamp": "2026-03-26T14:00:05.123Z",
  "activeImportWh": 523400,
  "activeExportWh": 12000,
  "activePowerW": 1250,
  "reactivePowerVAr": 85,
  "voltageV": 231.4,
  "frequencyHz": 50.01,
  "meterSerial": "E0051234567890"
}
```

| Field | Unit | Description |
|---|---|---|
| `activeImportWh` | Wh (cumulative) | Total energy consumed since meter install |
| `activeExportWh` | Wh (cumulative) | Total energy fed back since meter install |
| `activePowerW` | W (instantaneous) | Current power draw/feed |
| `reactivePowerVAr` | VAr | Reactive power for power quality |
| `voltageV` | V | Line voltage |
| `frequencyHz` | Hz | Grid frequency |

### Cadence

| Asset | Publish interval | Reason |
|---|---|---|
| Household meters | Every 10 seconds | DSMR P1 standard push rate |
| Solar inverter | Every 5 seconds | Fast ramp detection for battery control |
| Battery BMS | Every 5 seconds | Real-time SoC tracking |
| Grid meter | Every 10 seconds | Import/export balance |

### QoS and retention

- MQTT QoS 1 (at least once delivery)
- Broker: Mosquitto or EMQX, retained messages OFF (readings are time-series, stale data is useless)
- TLS 1.3, client certificates per device

### Where data lives

**MQTT broker memory only.** Messages are ephemeral — consumed by subscribers and discarded. No persistence at this stage. If the ingestion service is down, messages are lost (acceptable: the aggregation stage handles gaps).

---

## Stage 2 — MQTT Broker → Ingestion Service

### What happens

A backend service subscribes to `community/+/meter/+/reading` and writes every message to a time-series database.

### Ingestion service responsibilities

1. **Subscribe** to all meter topics for this community
2. **Validate** each message (schema check, timestamp sanity, device ID exists in registry)
3. **Deduplicate** using `(deviceId, timestamp)` composite key — MQTT QoS 1 can deliver duplicates
4. **Convert** cumulative Wh registers to delta Wh (energy consumed since last reading)
5. **Write** to TimescaleDB

### Technology

| Component | Choice | Why |
|---|---|---|
| Service runtime | Node.js or Python | Lightweight, async-friendly MQTT client |
| MQTT client | `mqtt.js` (Node) or `paho-mqtt` (Python) | Battle-tested |
| Database | **TimescaleDB** (PostgreSQL extension) | SQL-compatible time-series, native hypertables, built-in retention |

### Database: `raw_readings` hypertable

```sql
CREATE TABLE raw_readings (
    time           TIMESTAMPTZ   NOT NULL,
    device_id      INTEGER       NOT NULL,
    community_id   TEXT          NOT NULL,
    active_import_wh  BIGINT,        -- cumulative register
    active_export_wh  BIGINT,        -- cumulative register
    delta_import_wh   DOUBLE PRECISION, -- computed: current - previous
    delta_export_wh   DOUBLE PRECISION,
    active_power_w    DOUBLE PRECISION,
    voltage_v         DOUBLE PRECISION,
    frequency_hz      DOUBLE PRECISION,
    meter_serial      TEXT
);

SELECT create_hypertable('raw_readings', 'time');

CREATE INDEX idx_raw_device_time ON raw_readings (device_id, time DESC);
```

### Retention policy

```sql
SELECT add_retention_policy('raw_readings', INTERVAL '90 days');
```

Raw 10-second data is kept for 90 days (debugging, auditing), then automatically dropped.

### Where data lives

**TimescaleDB `raw_readings` hypertable.** ~8,640 rows per device per day (10-second cadence). For 6 devices: ~52,000 rows/day, ~1.6M rows/month. TimescaleDB compresses older chunks automatically.

---

## Stage 3 — 15-Minute Aggregation

### What happens

A scheduler fires every 15 minutes (on the quarter-hour: :00, :15, :30, :45). The aggregation service queries `raw_readings` for the just-completed interval and produces one summary row per device.

### Trigger

| Option | Implementation |
|---|---|
| pg_cron | `SELECT cron.schedule('*/15 * * * *', $$SELECT aggregate_interval()$$);` |
| Node.js | `setInterval(() => aggregateInterval(), 15 * 60 * 1000)` aligned to clock |
| External cron | Kubernetes CronJob calling the aggregation endpoint |

### Aggregation query (conceptual)

```sql
INSERT INTO interval_readings (interval_start, interval_end, device_id, community_id,
                                net_import_wh, net_export_wh, peak_power_w, reading_count)
SELECT
    date_trunc('hour', time) + INTERVAL '15 min' * FLOOR(EXTRACT(MINUTE FROM time) / 15)
        AS interval_start,
    date_trunc('hour', time) + INTERVAL '15 min' * (FLOOR(EXTRACT(MINUTE FROM time) / 15) + 1)
        AS interval_end,
    device_id,
    community_id,
    SUM(GREATEST(delta_import_wh, 0))  AS net_import_wh,
    SUM(GREATEST(delta_export_wh, 0))  AS net_export_wh,
    MAX(active_power_w)                AS peak_power_w,
    COUNT(*)                           AS reading_count
FROM raw_readings
WHERE time >= {interval_start} AND time < {interval_end}
GROUP BY 1, 2, device_id, community_id;
```

### Database: `interval_readings` hypertable

```sql
CREATE TABLE interval_readings (
    interval_start   TIMESTAMPTZ    NOT NULL,
    interval_end     TIMESTAMPTZ    NOT NULL,
    device_id        INTEGER        NOT NULL,
    community_id     TEXT           NOT NULL,
    net_import_wh    DOUBLE PRECISION NOT NULL,  -- energy consumed this interval
    net_export_wh    DOUBLE PRECISION NOT NULL,  -- energy fed back this interval
    peak_power_w     DOUBLE PRECISION,
    reading_count    INTEGER        NOT NULL,     -- data quality indicator
    aggregated_at    TIMESTAMPTZ    DEFAULT NOW(),
    PRIMARY KEY (interval_start, device_id)
);

SELECT create_hypertable('interval_readings', 'interval_start');
```

### Data quality check

If `reading_count` < expected count (e.g., < 80 out of 90 expected readings at 10-second cadence), the row is flagged as `estimated`. Missing intervals trigger an alert for manual review or the on-chain `settleIntervalEstimated` path.

### Example output for one 15-minute window (14:00–14:15)

| device_id | Asset | net_import_wh | net_export_wh | Meaning |
|---|---|---|---|---|
| 101 | Alice | 3,000 | 0 | Consumed 3.0 kWh |
| 201 | Bob | 4,500 | 0 | Consumed 4.5 kWh |
| 301 | Carol | 1,000 | 0 | Consumed 1.0 kWh |
| 401 | Solar | 0 | 8,000 | Produced 8.0 kWh |
| 501 | Battery | 500 | 0 | Charged 0.5 kWh (net import) |
| 601 | Grid import | 1,000 | 0 | Imported 1.0 kWh from grid |
| 901 | Grid export | 0 | 0 | Nothing exported |

**Balance check:** Production (8.0) = Consumption (3.0 + 4.5 + 1.0) + Battery charge (0.5) + Grid import shortfall absorbed (−1.0 imported to cover gap) → 8.0 produced + 1.0 imported = 3.0 + 4.5 + 1.0 + 0.5 = 9.0. Checks out.

### Where data lives

**TimescaleDB `interval_readings` hypertable.** Retained indefinitely (~672 rows/device/month). This is the "source of truth" for energy accounting. Every on-chain settlement traces back to a row here.

---

## Stage 4 — EMS Attribution Algorithm

### What happens

The EMS does not distribute physical energy — physics already did that on the shared bus. The EMS looks at what happened (meter readings) and computes the **financial attribution**: which kWh each household is deemed to have consumed from which source, and at what price. This is an accounting exercise, not a physical one.

### Inputs

| Input | Source | Data |
|---|---|---|
| Interval readings | TimescaleDB `interval_readings` | Per-device kWh for this 15-min window |
| Member registry | On-chain `getMember(addr)` | Device IDs, ownership %, active status |
| Battery config | On-chain `getBatteryInfo()` (EnergyDistribution) or stored off-chain | Price, max capacity, current SoC |
| Export price | On-chain `getExportPrice()` | Price per kWh for grid export |
| Community fee | On-chain `getCommunityFeeBps()` | Basis points taken from local revenue |
| Aggregator fee | On-chain `getAggregatorFeeBps()` | Basis points for Hypha Energy |
| Grid import price | External API (utility tariff / spot market) | Current import price per kWh |
| Local energy price | Community config (on-chain or DB) | Price per kWh for locally produced energy |

### The contract guides the EMS

The smart contract's parameters are not just for settlement — they define the economic rules that the EMS must follow when computing the financial attribution:

```
Contract parameter          │  EMS uses it to...
────────────────────────────┼──────────────────────────────────────────
ownershipBps per member     │  Allocate solar production proportionally
communityFeeBps             │  Factor fee into effective price comparison
aggregatorFeeBps            │  Factor fee into effective price comparison
exportPrice                 │  Decide whether to export surplus or store in battery
exportDeviceId              │  Tag export readings correctly
deviceToMember mapping      │  Attribute consumption readings to the right wallet
batteryPrice (if tracked)   │  Compare battery discharge cost vs. grid import cost
```

### Merit-order dispatch algorithm

The EMS allocates energy to each household following a priority stack, cheapest first:

```
Priority 1: Self-consumption of own solar share
    └─ Each member's ownership % of solar production, at LOCAL price
    └─ Alice gets 40% of 8 kWh = 3.2 kWh at 10¢/kWh

Priority 2: Battery discharge
    └─ If household needs more than their solar share, discharge battery
    └─ Battery energy priced at battery discharge cost (e.g., 8¢/kWh)

Priority 3: Other members' surplus
    └─ If a member produces/owns more than they consume, surplus goes to others
    └─ Priced at LOCAL price (same as solar)

Priority 4: Grid import (last resort)
    └─ Whatever remains unmet is imported from the grid
    └─ Priced at IMPORT price (e.g., 25¢/kWh, from utility tariff API)
```

### Algorithm pseudocode

```python
def build_consumption_readings(interval):
    readings = []

    # 1. Gather interval data
    solar_kwh     = get_interval(device=401).net_export_wh / 1000
    battery_delta = get_interval(device=501)  # positive = charging, negative = discharging
    grid_import   = get_interval(device=601).net_import_wh / 1000

    # 2. Get on-chain parameters
    members        = contract.getAllMembers()
    local_price    = community_config.local_price_per_kwh   # e.g., 10
    import_price   = utility_api.get_current_price()         # e.g., 25
    export_price   = contract.getExportPrice()
    battery_price  = community_config.battery_price_per_kwh  # e.g., 8

    # 3. Allocate solar production by ownership
    for member in members:
        solar_share = solar_kwh * member.ownershipBps / 10000
        consumption = get_interval(device=member.deviceId).net_import_wh / 1000

        # What they can self-consume from their solar share
        local_consumed = min(solar_share, consumption)
        remaining      = consumption - local_consumed

        if local_consumed > 0:
            readings.append({
                "deviceId":    member.deviceId,
                "quantity":    to_contract_units(local_consumed),
                "pricePerKwh": local_price,
                "source":      "LOCAL"
            })

        # 4. Battery discharge for remaining need
        if remaining > 0 and battery_available > 0:
            from_battery    = min(remaining, battery_available)
            remaining      -= from_battery
            battery_available -= from_battery
            readings.append({
                "deviceId":    member.deviceId,
                "quantity":    to_contract_units(from_battery),
                "pricePerKwh": local_price,  # battery is LOCAL source
                "source":      "LOCAL"
            })

        # 5. Grid import for whatever is left
        if remaining > 0:
            readings.append({
                "deviceId":    member.deviceId,
                "quantity":    to_contract_units(remaining),
                "pricePerKwh": import_price,
                "source":      "IMPORT"
            })

    # 6. Export surplus if any solar remains after all consumption + battery charge
    surplus = solar_kwh - total_consumed_locally - battery_charge
    if surplus > 0:
        readings.append({
            "deviceId":    901,  # export device
            "quantity":    to_contract_units(surplus),
            "pricePerKwh": 0,    # export revenue uses exportPrice set on-chain
            "source":      "LOCAL"
        })

    return readings
```

### Concrete example (14:00–14:15 interval)

**Production:** Solar park produces 8.0 kWh. Battery charges 0.5 kWh (controlled by EMS to store midday surplus).

**Available local energy:** 8.0 − 0.5 = 7.5 kWh

**Consumption:**
- Alice needs 3.0 kWh → solar share = 40% × 8.0 = 3.2 kWh → fully covered locally (3.0 kWh LOCAL)
- Bob needs 4.5 kWh → solar share = 40% × 8.0 = 3.2 kWh → 3.2 LOCAL + 1.3 remaining
- Carol needs 1.0 kWh → solar share = 20% × 8.0 = 1.6 kWh → fully covered locally (1.0 kWh LOCAL)

**Surplus after self-consumption:** Alice has 0.2 surplus, Carol has 0.6 surplus = 0.8 kWh available for Bob

**Bob's remaining 1.3 kWh:** 0.8 kWh from community surplus (LOCAL) + 0.5 kWh grid import (IMPORT)

**But wait:** The EMS also charged the battery 0.5 kWh from solar. Net surplus available for the community pool is actually reduced. The exact allocation depends on the EMS's battery scheduling, but the math must balance: production + import = consumption + battery charge + export.

**Final `ConsumptionReading[]` sent to the contract:**

```
consumeEnergy([
  { deviceId: 101, quantity: 30, pricePerKwh: 10, source: LOCAL  },  // Alice 3.0 kWh
  { deviceId: 201, quantity: 40, pricePerKwh: 10, source: LOCAL  },  // Bob 4.0 kWh local
  { deviceId: 201, quantity:  5, pricePerKwh: 25, source: IMPORT },  // Bob 0.5 kWh grid
  { deviceId: 301, quantity: 10, pricePerKwh: 10, source: LOCAL  },  // Carol 1.0 kWh
])
```

(Quantities are in contract units — multiply by the scaling factor configured in the system.)

### Database: `settlement_batches` table

Before submitting to the blockchain, the EMS persists the batch:

```sql
CREATE TABLE settlement_batches (
    id               SERIAL        PRIMARY KEY,
    community_id     TEXT          NOT NULL,
    interval_start   TIMESTAMPTZ   NOT NULL,
    interval_end     TIMESTAMPTZ   NOT NULL,
    readings_json    JSONB         NOT NULL,   -- the exact ConsumptionReading[] payload
    tx_hash          TEXT,                      -- filled after on-chain submission
    tx_status        TEXT          DEFAULT 'pending',  -- pending | submitted | confirmed | failed
    created_at       TIMESTAMPTZ   DEFAULT NOW(),
    submitted_at     TIMESTAMPTZ,
    confirmed_at     TIMESTAMPTZ
);

CREATE INDEX idx_batch_community_interval ON settlement_batches (community_id, interval_start);
```

### Where data lives

**PostgreSQL `settlement_batches` table.** This is the pre-chain audit trail. If the on-chain transaction fails, the EMS retries from this table. The `readings_json` column is the exact payload sent to `consumeEnergy()`, providing a link between off-chain metering and on-chain settlement.

---

## Stage 5 — On-Chain Settlement

### What happens

The EMS backend (its Ethereum address is whitelisted on the contract) submits a single transaction per 15-minute interval.

### The transaction

```
EnergyPPAImplementation.consumeEnergy(readings)
```

Where `readings` is the `ConsumptionReading[]` from Stage 4.

### What the contract does (two steps)

**Step 1 — Charge consumers:**

For each reading:
- Look up the member address from `deviceToMember[deviceId]`
- Compute `charge = quantity × pricePerKwh`
- Debit the member: `cashCreditBalance[member] -= charge`
- If `source == LOCAL`: add charge to `totalLocalRevenue`
- If `source == IMPORT`: add charge to `importCashCreditBalance`

For the export device (device 901):
- Compute `revenue = quantity × exportPrice`
- Add to `totalLocalRevenue`
- Debit `exportCashCreditBalance`

**Step 2 — Split local revenue:**

```
totalLocalRevenue (all LOCAL charges + export revenue)
  │
  ├── communityFeeBps (e.g. 5%)  → communityAddress balance += fee
  ├── aggregatorFeeBps (e.g. 3%) → aggregatorAddress balance += fee
  └── remainder                   → split by ownershipBps:
        ├── Alice (40%) → balance += 40% of remainder
        ├── Bob   (40%) → balance += 40% of remainder
        └── Carol (20%) → balance += 20% of remainder
```

**Step 3 — Zero-sum verification (modifier):**

After the function body executes, the `ensureZeroSum` modifier checks:

```
Σ member balances + community balance + aggregator balance
  + importCashCreditBalance + exportCashCreditBalance + settledBalance = 0
```

If this fails, the entire transaction reverts.

### Concrete numbers (continuing the example)

| Reading | Charge |
|---|---|
| Alice: 30 × 10 (LOCAL) | 300 |
| Bob: 40 × 10 (LOCAL) | 400 |
| Bob: 5 × 25 (IMPORT) | 125 |
| Carol: 10 × 10 (LOCAL) | 100 |

**Local revenue pot:** 300 + 400 + 100 = **800**

**Split:**
- Community (5%): 800 × 5% = 40
- Aggregator (3%): 800 × 3% = 24
- Remaining: 800 − 40 − 24 = 736
  - Alice (40%): 294.4 → 294 (rounding, last member gets remainder)
  - Bob (40%): 294
  - Carol (20%): 148

**Net balances after this interval:**
| Party | Debited | Credited | Net |
|---|---|---|---|
| Alice | −300 | +294 | **−6** |
| Bob | −400 −125 | +294 | **−231** |
| Carol | −100 | +148 | **+48** |
| Community | | +40 | **+40** |
| Aggregator | | +24 | **+24** |
| Import balance | | +125 | **+125** |
| **Total** | | | **0** |

### Positive vs. negative balances

- **Positive balance** → minted as ERC-20 `EnergyToken`, visible in wallets (Carol has 48 tokens)
- **Negative balance** → stored in `cashCreditBalances` mapping (Alice owes 6, Bob owes 231)

### Events emitted

```
EnergyConsumed(Alice,  30, 10, LOCAL)
EnergyConsumed(Bob,    40, 10, LOCAL)
EnergyConsumed(Bob,     5, 25, IMPORT)
EnergyConsumed(Carol,  10, 10, LOCAL)
RevenueDistributed(Alice, 294, 800)
RevenueDistributed(Bob,   294, 800)
RevenueDistributed(Carol, 148, 800)
CommunityFeeCollected(communityAddr, 40)
AggregatorFeeCollected(aggregatorAddr, 24)
```

### Where data lives

**EVM blockchain state:**
- `cashCreditBalances` mapping in `EnergyPPAStorage` (negative balances / debt)
- `EnergyToken` ERC-20 balances (positive balances / credits)
- `importCashCreditBalance`, `exportCashCreditBalance`, `settledBalance` (system accumulators)
- Transaction logs and event logs (permanent, indexed by block number)

---

## Stage 6 — Event Indexing and Dashboard

### What happens

A blockchain listener captures every event emitted in Stage 5 and stores it in a queryable database for the frontend dashboard.

### Architecture options

| Option | Pros | Cons |
|---|---|---|
| **Custom event listener** (ethers.js / viem) | Simple, full control, same Node.js stack | Must handle reorgs, RPC rate limits |
| **The Graph subgraph** | Decentralized, auto-reorg handling | Hosted service cost, GraphQL only |
| **Ponder** (open-source indexer) | TypeScript-native, Postgres-backed | Newer project |

### Database: `on_chain_events` table

```sql
CREATE TABLE on_chain_events (
    id               SERIAL        PRIMARY KEY,
    community_id     TEXT          NOT NULL,
    event_name       TEXT          NOT NULL,   -- 'EnergyConsumed', 'RevenueDistributed', etc.
    block_number     BIGINT        NOT NULL,
    tx_hash          TEXT          NOT NULL,
    log_index        INTEGER       NOT NULL,
    timestamp        TIMESTAMPTZ   NOT NULL,
    member_address   TEXT,
    data_json        JSONB         NOT NULL,   -- event parameters as JSON
    UNIQUE (tx_hash, log_index)
);

CREATE INDEX idx_events_community_time ON on_chain_events (community_id, timestamp DESC);
CREATE INDEX idx_events_member ON on_chain_events (member_address, timestamp DESC);
CREATE INDEX idx_events_name ON on_chain_events (event_name);
```

### What the dashboard queries

| Dashboard view | Query |
|---|---|
| Member balance history | `SELECT * FROM on_chain_events WHERE member_address = $1 ORDER BY timestamp` |
| Community revenue over time | `SELECT * FROM on_chain_events WHERE event_name = 'CommunityFeeCollected'` |
| Energy mix breakdown | Count `EnergyConsumed` events grouped by `source` (LOCAL vs IMPORT) |
| Export revenue | `SELECT * FROM on_chain_events WHERE event_name = 'EnergyExported'` |
| Real-time balances | Direct RPC call to `getCashCreditBalance(addr)` on the contract |

### Additional data for the dashboard (joined from off-chain)

The dashboard also pulls from `interval_readings` (Stage 3) for:
- Solar production curves
- Battery charge/discharge history
- Per-household consumption patterns
- Energy self-sufficiency ratio

### Where data lives

**PostgreSQL `on_chain_events` table.** This is a read-optimized mirror of blockchain events. The chain remains the source of truth; this table enables fast queries without RPC calls.

---

## Stage 7 — Financial Settlement (Stablecoin)

### What happens

Members with negative balances (debt) pay using EURC or EURe stablecoin. This converts virtual debt into real money.

### Two paths (depending on contract variant)

**Path A — EnergyPPAImplementation (recommended, simpler):**

Settlement is built into the same contract. The member calls:

```solidity
// Pay your own debt
settleOwnDebt(stablecoinAmount)

// Or someone pays on your behalf
settleDebt(debtor, stablecoinAmount)
```

The contract:
1. Checks the member has negative balance (debt)
2. Transfers EURC from the payer via `transferFrom` (requires prior `approve`)
3. Forwards EURC to `paymentRecipient` (community treasury or aggregator)
4. Adjusts `cashCreditBalance` toward zero
5. Updates `settledBalance` to maintain zero-sum

**Path B — Separate EnergySettlement contract (older design):**

Used with `EnergyDistributionImplementation`. Same logic but the settlement contract is a separate deployment that calls `energyDistribution.settleDebt()` internally.

### Conversion math

The contract's internal unit is energy credits (small unit). EURC has 6 decimals.

```
1 EURC = 1,000,000 units (6 decimals)
Internal credit = EURC amount / 10,000

Example: Bob owes 231 internal credits
  → 231 × 10,000 = 2,310,000 EURC units
  → = 2.31 EURC
  → Bob calls settleOwnDebt(2310000)
```

### Settlement timing

| When | Who initiates | How |
|---|---|---|
| Manual | Member, via wallet/dApp | Calls `settleOwnDebt()` with approved EURC |
| Monthly invoice | Backend/aggregator | Sends invoice off-chain, member pays on-chain |
| Auto-debit | Backend (if authorized) | Calls `settleDebt(debtor, amount)` with pre-approved EURC allowance |
| Third-party | Anyone (gift/sponsor) | Calls `settleDebt(debtor, amount)` |

### After settlement

```
Before: Bob's cashCreditBalance = -231
        settledBalance = 0

Bob calls settleOwnDebt(2310000)  // 2.31 EURC

After:  Bob's cashCreditBalance = 0
        settledBalance = -231
        2.31 EURC transferred to paymentRecipient
```

Zero-sum still holds because `settledBalance` absorbs the offset (external money entered the system).

### Where data lives

**EVM blockchain state:**
- Updated `cashCreditBalances` (debt reduced or cleared)
- Updated `settledBalance` (system-level accumulator)
- `DebtSettled` event emitted (indexed on-chain)
- EURC transfer event on the stablecoin contract

**Off-chain (Stage 6 indexer):**
- `on_chain_events` table captures the `DebtSettled` event
- Dashboard shows settlement history per member

---

## Complete Database Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                         OFF-CHAIN DATABASES                         │
├───────────────────────┬──────────────────────────────────────────────┤
│  TimescaleDB          │                                              │
│  ┌─────────────────┐  │  Retention: 90 days                         │
│  │  raw_readings   │  │  ~52K rows/day (6 devices × 10s cadence)    │
│  └─────────────────┘  │  Source: MQTT ingestion (Stage 2)           │
│  ┌─────────────────┐  │  Retention: indefinite                      │
│  │interval_readings│  │  ~672 rows/month (6 devices × 96 intervals) │
│  └─────────────────┘  │  Source: aggregation job (Stage 3)          │
├───────────────────────┼──────────────────────────────────────────────┤
│  PostgreSQL           │                                              │
│  ┌─────────────────┐  │  Pre-chain audit trail                      │
│  │settlement_batches│ │  One row per 15-min interval per community  │
│  └─────────────────┘  │  Source: EMS algorithm (Stage 4)            │
│  ┌─────────────────┐  │  Read-optimized mirror of chain events      │
│  │ on_chain_events │  │  Source: event indexer (Stage 6)            │
│  └─────────────────┘  │                                              │
├───────────────────────┼──────────────────────────────────────────────┤
│  ON-CHAIN (EVM)       │                                              │
│  ┌─────────────────┐  │  Member balances, ownership, device mapping │
│  │EnergyPPAStorage │  │  Import/export/settled accumulators         │
│  └─────────────────┘  │  Zero-sum invariant enforced every tx       │
│  ┌─────────────────┐  │  ERC-20 balances for positive credits       │
│  │  EnergyToken    │  │  Visible in wallets (MetaMask, etc.)        │
│  └─────────────────┘  │                                              │
│  ┌─────────────────┐  │  EURC/EURe stablecoin transfers             │
│  │  Stablecoin     │  │  Settlement payments to paymentRecipient    │
│  └─────────────────┘  │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

---

## Data Lineage: One kWh from Meter to Settlement

Follow a single kWh that Alice consumes at 14:05:

```
14:05:00  Alice's meter publishes MQTT message
          Topic: community/amsterdam-01/meter/101/reading
          Payload: { activeImportWh: 523400 → 524400 (delta: 1000 Wh) }
               │
               ▼
14:05:01  Ingestion service writes to TimescaleDB
          Table: raw_readings
          Row: (time=14:05:00, device_id=101, delta_import_wh=1000)
               │
               ▼
14:15:00  Aggregation job runs
          Sums all delta_import_wh for device 101 between 14:00–14:15
          Table: interval_readings
          Row: (interval_start=14:00, device_id=101, net_import_wh=3000)
               │
               ▼
14:15:05  EMS algorithm runs
          Reads interval_readings + contract parameters
          Computes: Alice consumed 3.0 kWh, covered by 3.0 kWh LOCAL solar
          Builds: { deviceId: 101, quantity: 30, pricePerKwh: 10, source: LOCAL }
          Table: settlement_batches
          Row: (interval_start=14:00, readings_json=[...], tx_status='pending')
               │
               ▼
14:15:10  Backend submits on-chain transaction
          Contract: EnergyPPAImplementation.consumeEnergy([...])
          Alice's cashCreditBalance debited 300 (3.0 kWh × 10¢)
          Alice's ownership share credited 294 (40% of 736 remainder)
          Net: Alice is −6 credits in debt
          Table: settlement_batches → tx_status='confirmed', tx_hash='0xabc...'
               │
               ▼
14:15:15  Event indexer captures EnergyConsumed event
          Table: on_chain_events
          Row: (event_name='EnergyConsumed', member_address=Alice, data={qty:30, price:10, source:LOCAL})
               │
               ▼
  (later)  Alice sees −6 credit debt on dashboard
           Alice calls settleOwnDebt(60000) → sends 0.06 EURC
           Balance → 0, settled.
```

---

## Battery: Bidirectional Data Flow

The battery is special because data flows in both directions — the EMS both **reads** the battery state and **controls** it.

```
                    ┌───────────────┐
                    │  Battery BMS  │
                    │  (device 501) │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │ READS (MQTT)│             │ COMMANDS (MQTT/Modbus)
              ▼             │             ▼
     ┌──────────────┐      │    ┌──────────────┐
     │  SoC, power, │      │    │  Charge at   │
     │  temperature │      │    │  2 kW for    │
     │  via telemetry│     │    │  next 15 min │
     └──────┬───────┘      │    └──────────────┘
            │              │             ▲
            ▼              │             │
     ┌──────────────┐      │    ┌──────────────┐
     │  raw_readings │     │    │  EMS controls │
     │  (Stage 2)   │      │    │  battery      │
     └──────────────┘      │    │  based on:    │
                           │    │  - solar fcst │
                           │    │  - prices     │
                           │    │  - SoC        │
                           │    │  - demand     │
                           │    └──────────────┘
```

### Battery control topics (MQTT)

```
community/{communityId}/battery/{deviceId}/command
  Payload: { "action": "charge", "powerW": 2000, "durationSec": 900 }

community/{communityId}/battery/{deviceId}/status
  Payload: { "socPct": 65.2, "powerW": -1500, "tempC": 28.3, "mode": "discharging" }
```

### How battery state reaches the contract

The battery's energy flow is already captured by its meter (device 501) and flows through Stages 1–5 like any other device. In the contract, battery energy is categorized as `LOCAL` source — it is community-owned production, priced at the configured battery discharge price.

---

## Contract Addresses and Deployment

For reference, the on-chain deployment for a community:

```
1.  Deploy EnergyToken("Amsterdam Energy", "ENERGY-AMS", owner)
2.  Deploy EnergyPPAImplementation via UUPS proxy
3.  Call initialize(owner, energyToken, stablecoinAddress, paymentRecipient)
4.  energyToken.setAuthorized(proxyAddress, true)
5.  updateWhitelist(emsBackendAddress, true)         ← the EMS backend wallet
6.  setCommunityAddress(communityTreasury)
7.  setCommunityFeeBps(500)                           ← 5%
8.  setAggregatorAddress(hyphaEnergyWallet)
9.  setAggregatorFeeBps(300)                          ← 3%
10. setExportDeviceId(901)
11. setExportPrice(exportPricePerKwh)
12. addMember(Alice, [101], 4000, metadataHash)       ← 40% ownership
13. addMember(Bob,   [201], 4000, metadataHash)       ← 40% ownership
14. addMember(Carol, [301], 2000, metadataHash)       ← 20% ownership
```

---

## Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              PHYSICAL LAYER                                         │
│                                                                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐ ┌─────────┐ ┌──────┐                │
│  │ Alice │ │  Bob  │ │ Carol │ │ Solar Park│ │ Battery │ │ Grid │                │
│  │  101  │ │  201  │ │  301  │ │    401    │ │   501   │ │601/901│               │
│  └───┬───┘ └───┬───┘ └───┬───┘ └─────┬─────┘ └────┬────┘ └───┬──┘                │
│      │         │         │           │             │          │                     │
│      └─────────┴─────────┴───────────┴─────────────┴──────────┘                     │
│                              │  MQTT (TLS)                                          │
│                              ▼                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              MQTT BROKER                                            │
│                     (Mosquitto / EMQX, in-memory)                                   │
│                              │                                                      │
│                              ▼                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                           BACKEND SERVICES                                          │
│                                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │ Ingestion Service│    │ Aggregation Svc  │    │   EMS Engine     │              │
│  │ (MQTT subscriber)│───►│ (15-min cron)    │───►│ (merit-order     │              │
│  │                  │    │                  │    │  dispatch)       │              │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘              │
│           │                       │                       │                         │
│           ▼                       ▼                       ▼                         │
│  ┌──────────────────────────────────────────────────────────────────┐               │
│  │                     TimescaleDB / PostgreSQL                     │               │
│  │  raw_readings │ interval_readings │ settlement_batches           │               │
│  └──────────────────────────────────────────────────────────────────┘               │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                            BLOCKCHAIN LAYER                                         │
│                                                                                     │
│  ┌────────────────────────────────┐  ┌──────────────┐  ┌────────────┐              │
│  │  EnergyPPAImplementation      │  │ EnergyToken  │  │  EURC      │              │
│  │  (UUPS Proxy)                 │  │ (ERC-20)     │  │ Stablecoin │              │
│  │                               │  │              │  │            │              │
│  │  consumeEnergy(readings)      │  │ Positive     │  │ Debt       │              │
│  │  settleOwnDebt(amount)        │  │ balances     │  │ settlement │              │
│  │  settleDebt(debtor, amount)   │  │ as tokens    │  │ payments   │              │
│  └────────────────────────────────┘  └──────────────┘  └────────────┘              │
│                   │                                                                 │
│                   ▼ events                                                          │
│  ┌────────────────────────────────┐                                                │
│  │  Event Indexer / Subgraph     │                                                 │
│  │  → PostgreSQL on_chain_events │──► Dashboard API ──► Frontend                   │
│  └────────────────────────────────┘                                                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Reference

```
contracts/
├── EnergyPPAImplementation.sol          ← core: consumeEnergy + settlement + revenue split
├── EnergyToken.sol                      ← ERC-20 for positive credit balances
├── EnergySettlement.sol                 ← stablecoin settlement (standalone, older path)
├── EnergyDistributionImplementation.sol ← alternative accounting engine (two-step distribute+consume)
├── NanoPPAFactory.sol                   ← bilateral agreement layer (advanced, per-agreement)
├── interfaces/
│   ├── IEnergyPPA.sol                   ← types: ConsumptionReading, MemberPPA, Source, events
│   ├── IEnergyDistribution.sol          ← types for distribution variant
│   ├── INanoPPA.sol                     ← types for bilateral agreements
│   └── IDistanceOracle.sol              ← geographic validation for REC compliance
└── storage/
    ├── EnergyPPAStorage.sol             ← state: balances, members, config, fees
    ├── EnergyDistributionStorage.sol    ← state for distribution variant
    └── NanoPPAStorage.sol               ← state for bilateral agreements
```

---

## Why the EMS Lives Off-Chain (and What Stays On-Chain)

### The temptation

It's natural to think: "If the contract enforces the financial rules, why not put the entire EMS logic on-chain? Then nobody has to trust the backend."

Your codebase actually shows both approaches, and the evolution tells a story.

### What you already tried: on-chain merit-order (EnergyDistributionImplementation)

The older `EnergyDistributionImplementation` contract puts the distribution logic on-chain:

```
Step 1: Backend calls distributeEnergyTokens(sources[], batteryState)
        Contract allocates kWh to each member by ownershipPercentage,
        builds a collectiveConsumption[] pool, sorts by price.

Step 2: Backend calls consumeEnergyTokens(requests[])
        Contract runs merit-order: self-consume own tokens first,
        then buy cheapest from the pool.
```

This works — the contract itself decides "Alice's kWh came from her own solar share at 8 cents, Bob bought from Carol's surplus at 8 cents, then from grid import at 25 cents." The logic is on-chain, verifiable, trustless.

But it comes with costs:

| Problem | Impact |
|---|---|
| **Gas cost** | Sorting `collectiveConsumption[]` by price is O(n²) bubble sort on-chain. With 3 members and 3 sources that's 9 entries — fine. With 50 members and 5 sources it's 250 entries and the sort alone can exceed block gas limits. |
| **Two transactions per interval** | `distributeEnergyTokens` then `consumeEnergyTokens` must be called sequentially. Double the gas, double the failure surface. |
| **Rigid algorithm** | The merit-order is hardcoded in Solidity. Changing the priority (e.g., "battery before community surplus" vs. "community surplus before battery") requires a contract upgrade via UUPS proxy. |
| **No external data access** | The contract can't call a utility price API or a weather forecast. Import price and battery decisions must be pre-computed off-chain anyway. |
| **Debugging** | The contract emits 6+ debug events (`DebugConsumptionLoopInfo`, `DebugConsumptionAttempt`, `DebugPoolStateAfterConsumption`) — a sign that getting the on-chain logic right was painful. |

### The ordering problem (the fairness bug in the on-chain approach)

This is the critical flaw. Look at `_processMemberConsumption` in `EnergyDistributionImplementation`:

```solidity
for (uint256 i = 0; i < requestCount; i++) {            // ← outer loop: each member
    // FIRST PASS: consume own tokens
    // SECOND PASS: buy from others (cheapest first in sorted pool)
    for (uint256 j = 0; j < collectiveConsumption.length; j++) {
        // buy from cheapest available slot
        collectiveConsumption[j].quantity -= canConsume;  // ← depletes the pool
    }
}
```

The outer loop processes members **sequentially**. Each member's second pass walks the `collectiveConsumption[]` pool from cheapest to most expensive and **depletes** entries as it goes. The next member in the array sees a pool with the cheap slots already emptied.

**Whoever is first in the array gets the cheapest energy. Whoever is last gets the leftovers.**

Here is a concrete example:

```
Setup:
  collectiveConsumption pool (sorted by price):
    [0] Alice's solar share: 3 kWh at 8¢  (owner: Alice)
    [1] Bob's solar share:   3 kWh at 8¢  (owner: Bob)
    [2] Carol's solar share: 2 kWh at 8¢  (owner: Carol)
    [3] Grid import:         4 kWh at 25¢ (owner: address(0))

  Consumption requests:
    Alice needs 5 kWh
    Bob needs 5 kWh
    Carol needs 2 kWh

Total: 12 kWh demand, 12 kWh supply. Perfect match.
```

**If the array order is [Alice, Bob, Carol]:**

```
Alice (processed first):
  Pass 1 — self-consume: eats her own 3 kWh at 8¢ from slot [0]. Needs 2 more.
  Pass 2 — buy from others: buys 2 kWh at 8¢ from Bob's slot [1] (cheapest available).
  Alice's total: 5 kWh × 8¢ = 40¢

Bob (processed second):
  Pass 1 — self-consume: his slot [1] has only 1 kWh left (Alice took 2). Gets 1 kWh at 8¢.
  Pass 2 — buy from others: Carol's slot [2] has 2 kWh at 8¢, takes it. Needs 2 more.
           Grid slot [3] has 4 kWh at 25¢, takes 2.
  Bob's total: 3 kWh × 8¢ + 2 kWh × 25¢ = 24 + 50 = 74¢

Carol (processed last):
  Pass 1 — self-consume: her slot [2] is depleted (Bob took it). Gets 0.
  Pass 2 — buy from others: only grid slot [3] left, 2 kWh at 25¢.
  Carol's total: 2 kWh × 25¢ = 50¢
```

**If the array order is [Carol, Bob, Alice]:**

```
Carol (processed first):
  Pass 1 — self-consume: eats her own 2 kWh at 8¢ from slot [2]. Done.
  Carol's total: 2 kWh × 8¢ = 16¢

Bob (processed second):
  Pass 1 — self-consume: eats his own 3 kWh at 8¢ from slot [1]. Needs 2 more.
  Pass 2 — Alice's slot [0] has 3 kWh at 8¢, takes 2.
  Bob's total: 5 kWh × 8¢ = 40¢

Alice (processed last):
  Pass 1 — self-consume: her slot [0] has 1 kWh left. Gets 1 kWh at 8¢. Needs 4 more.
  Pass 2 — no more 8¢ slots. Grid slot [3] has 4 kWh at 25¢.
  Alice's total: 1 kWh × 8¢ + 4 kWh × 25¢ = 8 + 100 = 108¢
```

**Same consumption, same production, same contract — but totally different prices depending on array order:**

| Member | Order [A, B, C] | Order [C, B, A] | Difference |
|---|---|---|---|
| Alice | 40¢ | 108¢ | **+170%** |
| Bob | 74¢ | 40¢ | −46% |
| Carol | 50¢ | 16¢ | −68% |

This is not a bug in the code — the code does exactly what it says. But it means **the backend operator silently controls who gets cheap energy by choosing the array order**. That's the opposite of trustless.

The self-consumption pass (pass 1) mitigates this somewhat — each member eats their own tokens first regardless of order. But whenever demand exceeds a member's own allocation (which is the common case for over-consumers), the second pass introduces the ordering bias.

### How EnergyPPAImplementation fixes this

In `EnergyPPAImplementation`, the contract doesn't run merit-order at all. Each reading arrives with its price already set:

```solidity
uint256 charge = readings[i].quantity * readings[i].pricePerKwh;
```

The contract doesn't care about ordering. Alice's reading says `30 qty at 10 price` — she pays 300 regardless of whether her reading is first or last in the array. Bob's reading says `40 qty at 10 price + 5 qty at 25 price` — he pays 525 regardless of position.

**The EMS computes the fair financial attribution off-chain.** But the algorithm matters. Two naive approaches that seem fair but aren't:

**Naive approach 1: Pro-rata by demand (unfair — socializes overconsumption)**

```
  Total local: 7.5 kWh, Total demand: 8.5 kWh
  Ratio: 7.5 / 8.5 = 88.2%

  Alice: 3.0 × 88.2% = 2.65 LOCAL + 0.35 IMPORT
  Bob:   4.5 × 88.2% = 3.97 LOCAL + 0.53 IMPORT
  Carol: 1.0 × 88.2% = 0.88 LOCAL + 0.12 IMPORT
```

Problem: Bob is consuming 4.5 kWh — far more than his 40% entitlement of 3.0 kWh. His overconsumption is what triggers the grid import. But under pro-rata, Alice and Carol also get pushed to IMPORT price even though their consumption fits within their ownership share. Bob's overconsumption is subsidized by everyone else paying higher prices.

**Naive approach 2: Ownership-weighted with leftover dump (unfair — arbitrary surplus routing)**

```
  Alice (40%): entitled to 3.0 kWh LOCAL → needs 3.0 → fully covered
  Bob (40%):   entitled to 3.0 kWh LOCAL → needs 4.5 → 1.5 short
  Carol (20%): entitled to 1.5 kWh LOCAL → needs 1.0 → 0.5 surplus

  Carol's surplus 0.5 kWh → goes to Bob? Or split between all who need more?
```

Problem: What if Alice also had a surplus? How do you split 2 members' surplus among 1 over-consumer? What if there are 3 surplus members and 2 over-consumers? The "dump to whoever needs it" approach is ad hoc and doesn't generalize.

**The correct approach: Ownership-first, then proportional surplus redistribution**

The fair algorithm has three passes. Each member's cost depends only on their own consumption relative to their own entitlement. Overconsumers pay for their own grid import — they don't drag others into expensive pricing.

```
PASS 1 — Ownership entitlement
  Each member's LOCAL entitlement = ownershipBps × totalLocal / 10000
  Each member consumes: min(entitlement, demand) from LOCAL

  Alice: entitled 3.0, needs 3.0 → consumes 3.0 LOCAL, surplus 0.0
  Bob:   entitled 3.0, needs 4.5 → consumes 3.0 LOCAL, deficit 1.5
  Carol: entitled 1.5, needs 1.0 → consumes 1.0 LOCAL, surplus 0.5

PASS 2 — Surplus redistribution
  Total surplus = 0.5 kWh (Carol's unused entitlement)
  Total deficit = 1.5 kWh (Bob's unmet demand)
  Redistributable = min(surplus, deficit) = 0.5 kWh

  Each deficit member gets surplus proportional to their deficit:
    Bob: 0.5 × (1.5 / 1.5) = 0.5 kWh LOCAL (he's the only one short)

  If there were multiple deficit members (say Bob needs 1.2, Dave needs 0.8):
    Bob:  0.5 × (1.2 / 2.0) = 0.3 kWh LOCAL
    Dave: 0.5 × (0.8 / 2.0) = 0.2 kWh LOCAL

PASS 3 — Grid import for remaining deficit
  Bob still needs: 1.5 - 0.5 = 1.0 kWh → IMPORT at grid price

RESULT:
  Alice: 3.0 kWh LOCAL at 10¢ → pays 30¢
  Bob:   3.5 kWh LOCAL at 10¢ + 1.0 kWh IMPORT at 25¢ → pays 60¢
  Carol: 1.0 kWh LOCAL at 10¢ → pays 10¢
```

Why this is fair:
- Alice consumes exactly her entitlement → pays only LOCAL price. She is not penalized for Bob's overconsumption.
- Carol under-consumed relative to her entitlement → her surplus helps the community, and she pays only LOCAL.
- Bob over-consumed beyond his entitlement → he gets the surplus first (still LOCAL price), but the remaining deficit is his IMPORT bill at grid price. The expensive import is his cost, not socialized.
- If Carol's surplus didn't exist, Bob would import 1.5 kWh instead of 1.0. Carol's surplus helps Bob but costs Carol nothing.

**The three-pass algorithm generalizes to any number of members:**

```python
def fair_allocation(members, total_local, local_price, import_price):
    # PASS 1: Ownership entitlement
    for m in members:
        m.entitlement = total_local * m.ownershipBps / 10000
        m.local_consumed = min(m.entitlement, m.demand)
        m.surplus = m.entitlement - m.local_consumed
        m.deficit = m.demand - m.local_consumed

    # PASS 2: Redistribute surplus proportionally to deficit
    total_surplus = sum(m.surplus for m in members)
    total_deficit = sum(m.deficit for m in members)
    redistributable = min(total_surplus, total_deficit)

    if redistributable > 0 and total_deficit > 0:
        for m in members:
            if m.deficit > 0:
                extra_local = redistributable * m.deficit / total_deficit
                m.local_consumed += extra_local
                m.deficit -= extra_local

    # PASS 3: Remaining deficit → grid import
    readings = []
    for m in members:
        if m.local_consumed > 0:
            readings.append({
                "deviceId": m.deviceId,
                "quantity": to_units(m.local_consumed),
                "pricePerKwh": local_price,
                "source": "LOCAL"
            })
        if m.deficit > 0:
            readings.append({
                "deviceId": m.deviceId,
                "quantity": to_units(m.deficit),
                "pricePerKwh": import_price,
                "source": "IMPORT"
            })

    return readings
```

### The same merit-order, but fair

The off-chain EMS runs the same conceptual merit-order (solar first, battery second, grid last). But it computes allocations **simultaneously for all members in three passes** — not sequentially draining a shared pool. The key difference:

```
On-chain (EnergyDistribution):          Off-chain EMS (EnergyPPA):

for each member (sequential):           PASS 1: entitlement for ALL members
  for each pool slot (cheapest first):   PASS 2: redistribute surplus → deficit
    take what you can                    PASS 3: remaining deficit = IMPORT
    deplete the slot
  end                                   Each member computed independently.
end                                     No ordering dependency.
                                         Overconsumer pays their own import.
Pool state CHANGES between members.
First member sees full pool.
Last member sees depleted pool.
```

### What you moved to: off-chain EMS (EnergyPPAImplementation)

The newer `EnergyPPAImplementation` contract takes a different approach — one function, pre-computed inputs:

```
Backend calls consumeEnergy(readings[])
  where each reading already has: deviceId, quantity, pricePerKwh, source

Contract just:
  1. Debits each consumer (qty × price)
  2. Splits local revenue (community fee → aggregator fee → owner shares)
  3. Verifies zero-sum
```

The contract has no idea about solar panels, batteries, or merit-order. The EMS computed all of that off-chain and submitted the result.

### The trust trade-off

```
On-chain EMS (EnergyDistribution)     Off-chain EMS (EnergyPPA)
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ Contract computes attribution│      │ Backend computes attribution │
│ ✓ Trustless                  │      │ ✗ Must trust the backend     │
│ ✓ Verifiable by anyone       │      │ ✓ Verifiable by audit trail  │
│ ✗ Expensive gas              │      │ ✓ Cheap (one tx per interval)│
│ ✗ Rigid (upgrade to change)  │      │ ✓ Flexible (deploy new code) │
│ ✗ Can't access external data │      │ ✓ Full access to APIs, DBs   │
│ ✗ Doesn't scale past ~30    │      │ ✓ Scales to thousands        │
│   members per community      │      │                              │
└──────────────────────────────┘      └──────────────────────────────┘
```

The "must trust the backend" concern is real but mitigated by:

1. **The contract still enforces zero-sum.** The EMS can't create or destroy money. If it submits bogus readings, the math still balances — someone gets overcharged, someone gets undercharged, but the total is always zero. No funds leak.

2. **The settlement_batches table is an audit trail.** Every `ConsumptionReading[]` submitted on-chain is also stored off-chain (Stage 4). Anyone can re-derive the readings from the raw meter data in `interval_readings` and compare.

3. **Events are public.** Every `EnergyConsumed` event is on the blockchain. A third party can independently read meter data and verify the attribution.

4. **The backend is whitelisted.** Only one address can call `consumeEnergy()`. If the operator is dishonest, the community owner can revoke the whitelist and appoint a different operator.

### Where each piece of logic lives

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OFF-CHAIN (EMS Backend)                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Real-time battery control                                   │   │
│  │  • Read solar production, household demand, battery SoC      │   │
│  │  • Decide: charge, discharge, or idle                        │   │
│  │  • Send MQTT command to battery BMS                          │   │
│  │  • Frequency: every 5-10 seconds                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  15-minute accounting attribution                            │   │
│  │  • Read interval_readings from TimescaleDB                   │   │
│  │  • Read contract params (ownership, fees, prices) via RPC    │   │
│  │  • Fetch grid import price from utility API                  │   │
│  │  • Run merit-order: solar share → battery → surplus → grid   │   │
│  │  • Build ConsumptionReading[] array                          │   │
│  │  • Persist to settlement_batches table                       │   │
│  │  • Submit consumeEnergy(readings) on-chain                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Forecasting and optimization (future)                       │   │
│  │  • Solar production forecast (weather API + ML model)        │   │
│  │  • Demand forecast (historical patterns)                     │   │
│  │  • Battery schedule optimization (minimize import cost)      │   │
│  │  • Grid price arbitrage signals                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        ON-CHAIN (Smart Contracts)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Configuration (the "constitution")                          │   │
│  │  • Member registry: wallet ↔ device IDs ↔ ownership %       │   │
│  │  • Community fee (basis points)                              │   │
│  │  • Aggregator fee (basis points)                             │   │
│  │  • Export device ID and export price                         │   │
│  │  • Stablecoin address and payment recipient                  │   │
│  │  • Whitelist of authorized backend addresses                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Financial enforcement (the "judiciary")                     │   │
│  │  • Debit consumers (qty × price)                             │   │
│  │  • Credit revenue pot → split by fees + ownership            │   │
│  │  • Verify zero-sum after every settlement                    │   │
│  │  • Manage debt settlement with stablecoin                    │   │
│  │  • Mint/burn EnergyToken for positive balances               │   │
│  │  • Emit events for transparency                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Governance (the "legislature")                              │   │
│  │  • Add/remove members (onlyWhitelist)                        │   │
│  │  • Change fee percentages (onlyOwner)                        │   │
│  │  • Update whitelist (onlyOwner)                              │   │
│  │  • Emergency reset                                           │   │
│  │  • Contract upgrade via UUPS proxy                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Theoretical design: Fair merit-order on-chain

It is possible to put the three-pass allocation algorithm on-chain and eliminate the trust dependency on the backend entirely. Here is how that contract would work.

**The interface changes.** Instead of submitting pre-computed `ConsumptionReading[]` (where the backend already decided prices and sources), the backend submits only raw metered quantities — the contract computes the attribution itself:

```solidity
struct MeterReading {
    uint256 deviceId;
    uint256 quantityKwh;   // what the meter measured (no price, no source)
}

function settleInterval(
    MeterReading[] calldata consumption,  // household meters
    uint256 totalLocalKwh,                // solar + battery discharge
    uint256 localPricePerKwh,             // community-agreed local price
    uint256 importPricePerKwh             // grid price (from oracle or admin)
) external onlyWhitelist ensureZeroSum;
```

**The three-pass algorithm in Solidity:**

```solidity
function settleInterval(
    MeterReading[] calldata consumption,
    uint256 totalLocalKwh,
    uint256 localPricePerKwh,
    uint256 importPricePerKwh
) external onlyWhitelist ensureZeroSum {

    // ── PASS 1: Ownership entitlement ─────────────────────────────
    // Each member gets their ownership % of total local production.
    // They consume up to min(entitlement, demand) from LOCAL.

    uint256 totalSurplus = 0;
    uint256 totalDeficit = 0;

    uint256[] memory entitlements = new uint256[](consumption.length);
    uint256[] memory localConsumed = new uint256[](consumption.length);
    uint256[] memory surplus = new uint256[](consumption.length);
    uint256[] memory deficit = new uint256[](consumption.length);

    for (uint256 i = 0; i < consumption.length; i++) {
        address addr = deviceToMember[consumption[i].deviceId];
        uint256 demand = consumption[i].quantityKwh;

        entitlements[i] = (totalLocalKwh * members[addr].ownershipBps) / 10000;
        localConsumed[i] = entitlements[i] < demand ? entitlements[i] : demand;
        surplus[i] = entitlements[i] - localConsumed[i];
        deficit[i] = demand - localConsumed[i];

        totalSurplus += surplus[i];
        totalDeficit += deficit[i];
    }

    // ── PASS 2: Redistribute surplus proportionally ───────────────
    // Unused entitlements are shared among members who need more.
    // Each deficit member gets a share proportional to their deficit.

    uint256 redistributable = totalSurplus < totalDeficit
        ? totalSurplus
        : totalDeficit;

    if (redistributable > 0 && totalDeficit > 0) {
        for (uint256 i = 0; i < consumption.length; i++) {
            if (deficit[i] > 0) {
                uint256 extraLocal = (redistributable * deficit[i]) / totalDeficit;
                localConsumed[i] += extraLocal;
                deficit[i] -= extraLocal;
            }
        }
    }

    // ── PASS 3: Charge each member ────────────────────────────────
    // LOCAL portion at local price, remaining deficit at import price.

    uint256 totalLocalRevenue = 0;

    for (uint256 i = 0; i < consumption.length; i++) {
        address addr = deviceToMember[consumption[i].deviceId];

        uint256 localCharge = localConsumed[i] * localPricePerKwh;
        uint256 importCharge = deficit[i] * importPricePerKwh;

        totalLocalRevenue += localCharge;
        importCashCreditBalance += int256(importCharge);

        _adjustCashCreditBalance(addr, -int256(localCharge + importCharge));

        emit EnergyConsumed(addr, localConsumed[i], localPricePerKwh, Source.LOCAL);
        if (deficit[i] > 0) {
            emit EnergyConsumed(addr, deficit[i], importPricePerKwh, Source.IMPORT);
        }
    }

    // ── Revenue split (same as EnergyPPAImplementation) ───────────
    _splitRevenue(totalLocalRevenue);
}
```

**Why this is order-independent:** Every member's allocation is computed from global totals (`totalLocalKwh`, `totalSurplus`, `totalDeficit`) — not from a pool that depletes as you iterate. Swapping the order of the `consumption[]` array produces identical results.

**Walk-through with the same numbers:**

```
Input:
  consumption = [Alice: 3.0 kWh, Bob: 4.5 kWh, Carol: 1.0 kWh]
  totalLocalKwh = 7.5 kWh
  localPrice = 10, importPrice = 25

PASS 1 — Entitlement:
  Alice: entitled 40% × 7.5 = 3.0, needs 3.0 → local=3.0, surplus=0.0, deficit=0.0
  Bob:   entitled 40% × 7.5 = 3.0, needs 4.5 → local=3.0, surplus=0.0, deficit=1.5
  Carol: entitled 20% × 7.5 = 1.5, needs 1.0 → local=1.0, surplus=0.5, deficit=0.0
  totalSurplus=0.5, totalDeficit=1.5

PASS 2 — Redistribute:
  redistributable = min(0.5, 1.5) = 0.5
  Bob gets: 0.5 × (1.5 / 1.5) = 0.5 extra LOCAL
  Bob: local=3.5, deficit=1.0

PASS 3 — Charge:
  Alice: 3.0 × 10 = 30         (all LOCAL)
  Bob:   3.5 × 10 + 1.0 × 25 = 60  (LOCAL + IMPORT)
  Carol: 1.0 × 10 = 10         (all LOCAL)

Same result regardless of array order. ✓
Bob pays for his own overconsumption. ✓
Alice and Carol are not penalized. ✓
```

**What the backend submits vs. what the contract computes:**

```
Off-chain EMS approach             On-chain merit-order approach
(current EnergyPPA):               (theoretical):

Backend submits:                   Backend submits:
  deviceId + quantity              deviceId + quantity  ← same
  + pricePerKwh    ← decided      totalLocalKwh        ← from solar meter
  + source         ← decided      localPrice           ← from config/oracle
                                   importPrice          ← from oracle
Contract trusts all 4 fields.
                                   Contract computes price + source itself.
                                   Backend only submits metered facts.
```

**Gas cost analysis:**

The three-pass algorithm loops over the members array three times (entitlement, redistribute, charge). For `n` members:

| Operation | Old on-chain (EnergyDistribution) | New on-chain (3-pass) |
|---|---|---|
| Pool construction | O(n × sources) | Not needed |
| Sorting | O(n² × sources²) bubble sort | Not needed |
| Allocation | O(n × pool_size) per member = O(n² × sources) | O(n) per pass × 3 = O(3n) |
| Total | O(n² × sources²) | **O(n)** |

The three-pass approach is dramatically cheaper because it avoids building and sorting a collective pool entirely. It works with simple arrays and arithmetic — no storage writes for intermediate pool state.

| Community size | Old approach gas (estimate) | 3-pass gas (estimate) |
|---|---|---|
| 3 members | ~150k | ~80k |
| 10 members | ~500k | ~120k |
| 50 members | ~5M+ (may hit block limit) | ~400k |
| 200 members | Impossible | ~1.5M |

**What remains off-chain even in the on-chain approach:**

The three-pass contract handles the accounting merit-order (who pays what, from what source). But these still must live off-chain:

| Still off-chain | Why |
|---|---|
| Battery control | Real-time hardware commands, needs sub-second latency |
| Solar forecasting | Needs weather APIs, ML models |
| Battery scheduling | Optimization over future intervals, not just current |
| Raw meter ingestion | 10-second MQTT data, too much volume for chain |
| 15-minute aggregation | Summarizing raw data into interval totals |
| Import price feed | External API call, needs an oracle to bring on-chain |

The backend still reads the meters, aggregates to 15-minute intervals, controls the battery, and fetches the import price. But the financially sensitive decision — "who pays LOCAL price vs. IMPORT price" — is now computed by the contract, not the backend.

### The hard truth: on-chain merit-order does NOT make the system trustless

Moving the allocation algorithm into the contract is a real improvement — it guarantees the **computation** is fair and order-independent. But it does not solve the trust problem. The trust problem is at the data layer, not the logic layer.

**What the contract receives and cannot verify:**

```
settleInterval(
    consumption = [Alice: 3.0, Bob: 4.5, Carol: 1.0],   ← backend says so
    totalLocalKwh = 7.5,                                  ← backend says so
    localPricePerKwh = 10,                                ← admin/oracle says so
    importPricePerKwh = 25                                ← admin/oracle says so
)
```

Every input is supplied by a trusted party. The contract has no way to verify any of them:

| Input | Who provides it | Can the contract verify it? | Attack vector |
|---|---|---|---|
| Alice consumed 3.0 kWh | Backend (from meter) | No | Backend inflates Alice's consumption → she pays more |
| Bob consumed 4.5 kWh | Backend (from meter) | No | Backend deflates Bob's consumption → he pays less |
| Total local = 7.5 kWh | Backend (from solar meter) | No | Backend claims 10 kWh local → everyone pays LOCAL price, grid import cost disappears from the books |
| Local price = 10 | Admin or config | No (it's a parameter) | Admin sets a favorable price for insiders |
| Import price = 25 | Oracle or admin | No (unless Chainlink) | Backend claims import price is 50 → overconsumers are overcharged |

**The on-chain 3-pass algorithm guarantees:**
- Given these inputs, the split is mathematically fair (no ordering bias)
- Given these inputs, overconsumers pay their own import (not socialized)
- Given these inputs, zero-sum holds

**It does NOT guarantee:**
- The inputs reflect reality
- Alice actually consumed 3.0 kWh and not 2.5
- The solar park actually produced 7.5 kWh and not 9.0
- The import price is the real grid tariff

**Comparison: what do you actually gain?**

```
                            Off-chain EMS        On-chain 3-pass
                            (EnergyPPA)          (theoretical)
                            ──────────────       ──────────────
Meter readings trusted?     Yes (backend)        Yes (backend)      ← same
Prices trusted?             Yes (backend)        Yes (oracle/admin) ← same
Allocation algorithm fair?  Trust the backend    Verified on-chain  ← improved
Allocation auditable?       Via settlement_batches  On-chain code   ← improved
Can backend favor a member? Yes (set their price   No (contract     ← improved
                            lower)               computes prices)
Can backend fabricate       Yes                  Yes                ← same
  meter readings?
Can backend fabricate       Yes (it sets it)     Yes (it submits    ← same
  totalLocalKwh?                                  the number)
```

The on-chain approach eliminates one specific attack: the backend choosing to give one member a cheaper price than another. In the off-chain model, the backend submits `pricePerKwh` per reading — it could charge Alice 10 and Bob 25 for the same LOCAL energy. In the on-chain model, the contract computes prices from the algorithm, so all LOCAL energy is priced the same.

But the bigger attacks — fabricating meter data, lying about total production — remain possible in both approaches. The trust boundary is the physical meter and the MQTT pipeline, not the contract.

### What would actually make it trustless (and why it's hard)

To truly remove trust from the system, you would need the contract to verify the **inputs**, not just the computation:

| Input | How to verify on-chain | Difficulty |
|---|---|---|
| Meter readings | Hardware-signed readings (meter has a private key, signs each reading, contract verifies signature) | High — requires smart meters with cryptographic chips (some exist: DSMR 5.0 P1 has a signing capability, but it's not standard) |
| Total local production | Cross-check: sum of individual consumption + grid import/export = total production (energy balance equation) | Medium — the contract could verify this if it receives ALL meter readings, not just consumption |
| Import price | Chainlink or another decentralized oracle posting grid prices | Medium — oracle infrastructure exists but adds cost and dependency |
| Local price | Governance vote by members (on-chain DAO proposal) | Low — already feasible with existing DAO tools |

**The energy balance cross-check is the most practical improvement.** If the contract receives all 5 readings (3 households + grid import + grid export) and `totalLocalKwh`, it can verify:

```
totalLocalKwh + gridImport = Alice + Bob + Carol + gridExport + batteryCharge

7.5 + 1.0 = 3.0 + 4.5 + 1.0 + 0.0 + 0.0
8.5 = 8.5  ✓
```

If the backend fabricates one number, the balance breaks and the contract reverts. This doesn't prove each individual reading is correct, but it proves they are **internally consistent**. The backend would have to fabricate multiple readings that still balance — much harder.

```solidity
function settleInterval(
    MeterReading[] calldata consumption,
    uint256 totalLocalKwh,
    uint256 gridImportKwh,
    uint256 gridExportKwh,
    uint256 batteryChargeKwh,
    uint256 localPricePerKwh,
    uint256 importPricePerKwh
) external onlyWhitelist ensureZeroSum {
    // Energy balance check — catches fabricated readings
    uint256 totalConsumption = 0;
    for (uint256 i = 0; i < consumption.length; i++) {
        totalConsumption += consumption[i].quantityKwh;
    }
    require(
        totalLocalKwh + gridImportKwh == totalConsumption + gridExportKwh + batteryChargeKwh,
        "Energy balance violated"
    );

    // ... three-pass allocation as before ...
}
```

This gives you: **fair algorithm (on-chain) + internally consistent data (energy balance) + financial enforcement (zero-sum)**. The only remaining trust assumption is that the individual meter readings match physical reality — which is a hardware problem, not a software one.

### Summary: what each approach actually buys you

```
┌─────────────────────────────┬────────────────┬────────────────┬────────────────┐
│ Property                    │ Off-chain EMS  │ On-chain 3-pass│ 3-pass + energy│
│                             │ (EnergyPPA)    │ (theoretical)  │ balance check  │
├─────────────────────────────┼────────────────┼────────────────┼────────────────┤
│ Fair allocation algorithm   │ Trust backend  │ Verified       │ Verified       │
│ No ordering bias            │ Trust backend  │ Guaranteed     │ Guaranteed     │
│ Overconsumer pays own import│ Trust backend  │ Guaranteed     │ Guaranteed     │
│ Can't favor one member      │ No             │ Yes            │ Yes            │
│ Meter data is real          │ Trust backend  │ Trust backend  │ Consistent*    │
│ Production data is real     │ Trust backend  │ Trust backend  │ Consistent*    │
│ Prices are real             │ Trust backend  │ Trust oracle   │ Trust oracle   │
│ Gas cost                    │ Lowest         │ Low            │ Low            │
│ Flexibility                 │ Highest        │ Medium         │ Medium         │
└─────────────────────────────┴────────────────┴────────────────┴────────────────┘

* "Consistent" means the numbers must balance against each other.
  The backend can't fabricate one reading without adjusting all others to match.
  Not the same as "verified against physical reality" — but much harder to game.
```

### Recommendation

For most communities, the off-chain EMS with `EnergyPPAImplementation` is sufficient. The backend is operated by the aggregator (Hypha Energy), who has a reputation and legal obligation. The `settlement_batches` audit trail and public on-chain events provide accountability.

For communities that want stronger guarantees without full trustlessness (which requires hardware-signed meters), the on-chain three-pass algorithm with energy balance check is the best practical option. It guarantees fair computation and internally consistent data — the backend can still lie, but it has to lie consistently across all readings, which is detectable by any member who reads their own meter.

Either way:
- **On-chain**: configuration + allocation logic (optional) + energy balance check (optional) + financial settlement + zero-sum
- **Off-chain**: metering + aggregation + battery control + optimization + price feeds

The honest answer: blockchains are good at enforcing financial rules (zero-sum, fee splits, debt settlement). They are not good at verifying physical reality. The gap between "what the meter says" and "what happened physically" is a hardware trust problem that no smart contract can solve.

---

## Glossary

| Term | Definition |
|---|---|
| **EMS** | Energy Management System — the backend that (1) controls the battery in real-time and (2) computes the financial attribution of energy after each interval, then submits settlements on-chain. It does NOT route or distribute physical energy — physics does that on the shared bus. |
| **Merit-order** | The accounting rule for attributing consumption to sources, cheapest first: solar entitlement → community surplus → grid import. This is a financial label, not a physical action — all energy already flowed on the shared bus. |
| **LOCAL** | Energy produced within the community (solar, battery discharge) |
| **IMPORT** | Energy purchased from the external grid (utility) |
| **cashCreditBalance** | Internal accounting unit in the contract; positive = credit (ERC-20 token), negative = debt |
| **ownershipBps** | Basis points (10000 = 100%) defining a member's share of community revenue |
| **Zero-sum** | Every credit has a matching debit; total of all balances always equals zero |
| **EURC / EURe** | Euro-denominated stablecoins used for financial settlement |
| **P1/P4 port** | Standard smart meter data interface (DSMR protocol, common in EU) |
| **SoC** | State of Charge — battery's current energy level as percentage of capacity |
| **Hypertable** | TimescaleDB's partitioned table optimized for time-series data |
| **UUPS Proxy** | Upgradeable proxy pattern — allows contract logic to be updated without losing state |
