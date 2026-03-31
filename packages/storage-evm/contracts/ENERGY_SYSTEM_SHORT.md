# Energy Community — Short Version

This document is a quick walkthrough of the new energy settlement system for non-technical stakeholders. It needs to be aligned with Zek — if he doesn't mind, let's have a call to go through it.

**Part 1** — Technical pipeline: how meter data flows from hardware to databases to the blockchain.

**Part 2** — The EMS algorithm that fairly determines who pays what.

**Why the rearchitecture?** The old system processed members sequentially. Whoever was first in the array got cheap solar; whoever was last paid expensive grid prices. Reordering the array could swing a bill by 100%+. It also had a single price for all local energy — no way to differentiate solar from battery. The new system fixes both: proportional fair distribution and per-source pricing.

---

## The Community

```
         Alice   Bob   Carol  Dave   Eve   Solar Park   Battery
         (30%)  (30%)  (10%)  (20%)  (10%)
```

- **Alice, Bob, Carol, Dave** — households that consume electricity.
- **Eve** — investor. Owns 10%, doesn't consume. Earns revenue.
- **Solar park** — produces electricity for the community.
- **Battery** — stores excess solar for later. Controlled by the EMS.
- **Grid** — fallback when solar + battery aren't enough.

Ownership % determines your share of cheap energy and your share of revenue.

---

## Part 1 — Data Pipeline

### Step 1: Meters → MQTT broker

Every 10 seconds, smart meters send readings via **MQTT**. Data is temporary — gone once delivered.

### Step 2: MQTT → TimescaleDB `raw_readings`

An ingestion service writes every reading to **TimescaleDB**. Kept 90 days, then deleted.

### Step 3: Aggregate every 15 minutes → TimescaleDB `interval_readings`

A scheduled job sums the raw readings into one number per meter per 15-minute window. Kept forever.

```
14:00–14:15   │ Alice  2.0 kWh consumed │ Bob   5.0 kWh consumed
14:00–14:15   │ Carol  1.0 kWh consumed │ Dave  3.0 kWh consumed
14:00–14:15   │ Solar  8.0 kWh produced │ Battery 2.0 kWh discharged
14:00–14:15   │ Grid   1.0 kWh imported │ Eve — no meter (investor)
```

### Step 4: EMS calculates the fair split

The **EMS** (Energy Management System) reads the interval summaries and runs the algorithm (see Part 2). It also **controls the battery** — charge/discharge commands via MQTT. This is the only physical action the software takes.

| Input | Source |
|---|---|
| Consumption & production | `interval_readings` in TimescaleDB |
| Ownership percentages | Blockchain smart contract |
| Solar & battery prices | Blockchain — set when community created PPAs |
| Grid import/export prices | External APIs (retailer tariffs, spot market) |

Output: a list of readings per member per source, with prices. Saved to **PostgreSQL** `settlement_batches` (kept forever).

### Step 5: Blockchain settlement

The EMS sends one transaction to the smart contract:

```
settleInterval([
  { device: Alice,  amount: 2.00 kWh, price:  8 ct, source: LOCAL   },
  { device: Bob,    amount: 3.12 kWh, price:  8 ct, source: LOCAL   },
  { device: Bob,    amount: 1.08 kWh, price: 15 ct, source: BATTERY },
  { device: Bob,    amount: 0.80 kWh, price: 25 ct, source: IMPORT  },
  { device: Carol,  amount: 0.80 kWh, price:  8 ct, source: LOCAL   },
  { device: Carol,  amount: 0.20 kWh, price: 15 ct, source: BATTERY },
  { device: Dave,   amount: 2.08 kWh, price:  8 ct, source: LOCAL   },
  { device: Dave,   amount: 0.72 kWh, price: 15 ct, source: BATTERY },
  { device: Dave,   amount: 0.20 kWh, price: 25 ct, source: IMPORT  },
])
```

Sources: LOCAL (solar), BATTERY, IMPORT (grid). LOCAL + BATTERY charges go into a revenue pot. IMPORT goes to the import balance (community's grid bill).

The contract does two things:
1. **Charge consumers** — amount × price, debit each member.
2. **Split the revenue pot** — community fee % → aggregator fee % → remainder to all owners by ownership %.

If the math doesn't sum to zero, the transaction is rejected. Positive balances become **Energy Credits** (ERC-20 token). Negative balances are debt, settled later with EURC stablecoin.

### Pipeline summary

```
Meters → MQTT → TimescaleDB "raw_readings" (90 days)
  → TimescaleDB "interval_readings" (forever)
    → EMS algorithm → PostgreSQL "settlement_batches" (forever)
      → Blockchain smart contract (permanent)
        → Energy Credit balances, settled with EURC
```

---

## Part 2 — The EMS Algorithm

Three steps, every 15 minutes. Cheapest source first: solar (8 ct) → battery (15 ct) → grid (25 ct).

**Prices from the blockchain:** solar price, battery price, community fee, aggregator fee — set when the community created its PPAs.
**Prices from external APIs:** grid import price, grid export price — change with market conditions.

The EMS also **controls the battery** (charge/discharge commands via MQTT).

### Setup

```
Solar: 8 kWh at 8 ct   │   Battery: 2 kWh at 15 ct   │   Grid import: 25 ct
Alice: 2 kWh  │  Bob: 5 kWh  │  Carol: 1 kWh  │  Dave: 3 kWh  │  Eve: 0 kWh
Total consumed: 11 kWh  │  Total local: 10 kWh  │  Shortfall: 1 kWh from grid
```

### Step 1 — Ownership share

Each member gets their % of solar and battery. Consume cheapest first.

```
           Solar share   Battery share   Total    Needs    Result
Alice 30%: 2.4 kWh       0.6 kWh         3.0      2.0     Surplus 1.0
Bob   30%: 2.4           0.6             3.0      5.0     Deficit 2.0
Carol 10%: 0.8           0.2             1.0      1.0     Perfect fit
Dave  20%: 1.6           0.4             2.0      3.0     Deficit 1.0
Eve   10%: 0.8           0.2             1.0      0.0     Surplus 1.0
```

Alice uses 2.0 solar, surplus = 0.4 solar + 0.6 battery. Eve uses nothing, surplus = 0.8 solar + 0.2 battery.

### Step 2 — Redistribute surplus proportionally by ownership

Deficit members: Bob (30%) + Dave (20%) = 50% combined.

**Solar surplus (0.4 + 0.8 = 1.2 kWh at 8 ct):**

```
Bob:  1.2 × 30/50 = 0.72 kWh    Dave: 1.2 × 20/50 = 0.48 kWh
```

**Battery surplus (0.6 + 0.2 = 0.8 kWh at 15 ct):**

```
Bob:  0.8 × 30/50 = 0.48 kWh    Dave: 0.8 × 20/50 = 0.32 kWh
```

Each source keeps its price. Bob still needs 0.8 kWh, Dave still needs 0.2 kWh.

### Step 3 — Remaining deficit = grid import

Bob: 0.8 kWh at 25 ct. Dave: 0.2 kWh at 25 ct. Total: 1.0 kWh.

### Final bill

```
             Solar          Battery         Grid          Total
             kWh    cost    kWh    cost     kWh   cost
Alice:       2.00   16.0    —       —       —      —      16.00 ct
Bob:         3.12   25.0    1.08   16.2     0.8   20.0    61.16 ct
Carol:       0.80    6.4    0.20    3.0     —      —       9.40 ct
Dave:        2.08   16.6    0.72   10.8     0.2    5.0    32.44 ct
Eve:         —       —      —       —       —      —       0.00 ct
Total:       8.00          2.00            1.00           119.00 ct
```

### On-chain settlement

Revenue pot (LOCAL + BATTERY): 94.00 ct. Import balance: 25.00 ct.

```
Community fee (5%):    4.70 ct    Aggregator fee (3%):  2.82 ct
Remaining for owners: 86.48 ct

Alice 30%: 25.94    Bob 30%: 25.94    Carol 10%: 8.65    Dave 20%: 17.30    Eve 10%: 8.65
```

### Energy Credit balances

```
               Charged     Earned      Balance
Alice:         -16.00      +25.94      +9.94 ct    ← credit (under-consumed)
Bob:           -61.16      +25.94      -35.22 ct   ← debt (over-consumed)
Carol:          -9.40       +8.65      -0.75 ct    ← small debt
Dave:          -32.44      +17.30      -15.14 ct   ← debt
Eve:             0.00       +8.65      +8.65 ct    ← credit (investor)
Community:        —         +4.70      +4.70 ct
Aggregator:       —         +2.82      +2.82 ct
Import:           —           —        +25.00 ct
                                       ─────────
                               Zero-sum: 0.00 ✓
```

**Positive** = Energy Credits (ERC-20 token). **Negative** = debt, settled with EURC stablecoin.

---

## Export Example

Sunny afternoon, low consumption. Solar: 10 kWh at 8 ct. Battery idle.

```
Alice: 2 kWh │ Bob: 2 kWh │ Carol: 1 kWh │ Dave: 1 kWh │ Eve: 0 kWh
Total: 6 kWh │ Surplus: 4 kWh → exported at 5 ct/kWh (feed-in tariff from API)
```

Everyone has more than they need. No deficits, no redistribution. 4 kWh exported.

```
settleInterval([
  { device: Alice,   amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Bob,     amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Carol,   amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Dave,    amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Export,  amount: 4.0 kWh, price: 5 ct, source: LOCAL  },
])
```

Export is just another entry. Revenue pot: 48 (consumption) + 20 (export) = 68 ct.

```
Community (5%): 3.40    Aggregator (3%): 2.04    Owners: 62.56

Alice 30%: 18.77    Bob 30%: 18.77    Carol 10%: 6.26    Dave 20%: 12.51    Eve 10%: 6.26
```

### Energy Credit balances

```
               Charged     Earned      Balance
Alice:         -16.00      +18.77      +2.77 ct    ← credit
Bob:           -16.00      +18.77      +2.77 ct    ← credit
Carol:          -8.00       +6.26      -1.74 ct    ← small debt
Dave:           -8.00      +12.51      +4.51 ct    ← credit
Eve:             0.00       +6.26      +6.26 ct    ← credit (investor)
Community:        —         +3.40      +3.40 ct
Aggregator:       —         +2.04      +2.04 ct
Export:           —           —        -20.00 ct   ← grid owes community
                                       ─────────
                               Zero-sum: 0.00 ✓
```

When production exceeds consumption, almost everyone earns. Carol has a small debt because her 10% ownership earns less than what she paid for her 1 kWh.
