# Energy Community — Short Version

This document is a quick walkthrough of the new energy settlement system for non-technical stakeholders. It needs to be aligned with Zek — if he doesn't mind, let's have a call to go through it.

**Part 1** — Technical pipeline: how meter data flows from hardware to databases to the blockchain.

**Part 2** — The EMS algorithm that fairly determines who pays what.

**Why the rearchitecture?** The old system processed members sequentially. Whoever was first in the array got cheap solar; whoever was last paid expensive grid prices. Reordering the array could swing a bill by 100%+. It also had a single price for all local energy — no way to differentiate solar from battery. The new system fixes both: proportional fair distribution and per-source pricing.

---

## The Community

```
         Alice   Bob   Carol  Dave   Eve   Solar Park   Battery
```

- **Alice, Bob, Carol, Dave** — households that consume electricity.
- **Eve** — investor. Doesn't consume. Earns revenue from ownership.
- **Solar park** — produces electricity for the community.
- **Battery** — stores excess solar for later. Controlled by the EMS.
- **Grid** — fallback when solar + battery aren't enough.

Each source has its own ownership structure:

| Member | Solar Park | Battery |
|--------|-----------|---------|
| Alice  | 30%       | 25%     |
| Bob    | 30%       | 25%     |
| Carol  | 10%       | —       |
| Dave   | 20%       | 25%     |
| Eve    | 10%       | 25%     |

Your ownership % in a source determines your share of cheap energy from that source and your share of its revenue. Carol invested only in solar, not the battery.

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
| Ownership percentages (per source) | Blockchain smart contract |
| Solar & battery prices | Blockchain — set when community created PPAs |
| Grid import/export prices | External APIs (retailer tariffs, spot market) |

Output: a list of readings per member per source, with prices. Saved to **PostgreSQL** `settlement_batches` (kept forever).

### Step 5: Blockchain settlement

The EMS sends one transaction to the smart contract:

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

Sources: LOCAL (solar), BATTERY, IMPORT (grid). Revenue from each source goes to that source's owners. IMPORT goes to the import balance (community's grid bill).

The contract does two things:
1. **Charge consumers** — amount × price, debit each member.
2. **Split revenue per source** — community fee % → aggregator fee % → remainder to that source's owners by their ownership %.

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

Solar ownership:   Alice 30% │ Bob 30% │ Carol 10% │ Dave 20% │ Eve 10%
Battery ownership: Alice 25% │ Bob 25% │ Carol  0% │ Dave 25% │ Eve 25%
```

### Step 1 — Ownership share

Each member gets their % of each source (different ownership per source). Consume cheapest first (solar before battery).

```
           Solar share   Battery share   Total    Needs    Result
Alice:     2.4 kWh       0.5 kWh         2.9      2.0     Surplus 0.9
Bob:       2.4           0.5             2.9      5.0     Deficit 2.1
Carol:     0.8           —               0.8      1.0     Deficit 0.2
Dave:      1.6           0.5             2.1      3.0     Deficit 0.9
Eve:       0.8           0.5             1.3      0.0     Surplus 1.3
```

Alice uses 2.0 solar, surplus = 0.4 solar + 0.5 battery. Eve uses nothing, surplus = 0.8 solar + 0.5 battery. Carol has no battery share (0% battery ownership).

### Step 2 — Redistribute surplus by source ownership

Each source's surplus is redistributed among deficit members proportional to their ownership of *that* source.

**Solar surplus (0.4 + 0.8 = 1.2 kWh at 8 ct):**

Deficit members with solar ownership: Bob (30%) + Carol (10%) + Dave (20%) = 60%.

```
Bob:   1.2 × 30/60 = 0.60 kWh
Carol: 1.2 × 10/60 = 0.20 kWh  ← exactly covers Carol
Dave:  1.2 × 20/60 = 0.40 kWh
```

**Battery surplus (0.5 + 0.5 = 1.0 kWh at 15 ct):**

Deficit members with battery ownership: Bob (25%) + Dave (25%) = 50%. Carol has 0% battery ownership — no battery surplus for her.

```
Bob:  1.0 × 25/50 = 0.50 kWh
Dave: 1.0 × 25/50 = 0.50 kWh  ← exactly covers Dave
```

Each source keeps its price. Bob still needs 1.0 kWh.

### Step 3 — Remaining deficit = grid import

Bob: 1.0 kWh at 25 ct. Total: 1.0 kWh.

### Final bill

```
             Solar          Battery         Grid          Total
             kWh    cost    kWh    cost     kWh   cost
Alice:       2.00   16.0    —       —       —      —      16.00 ct
Bob:         3.00   24.0    1.00   15.0     1.0   25.0    64.00 ct
Carol:       1.00    8.0    —       —       —      —       8.00 ct
Dave:        2.00   16.0    1.00   15.0     —      —      31.00 ct
Eve:         —       —      —       —       —      —       0.00 ct
Total:       8.00   64.0    2.00   30.0     1.00  25.0   119.00 ct
```

### On-chain settlement

Revenue is split per source — each source's revenue goes to its owners.

**Solar revenue (LOCAL): 64.00 ct**

```
Community fee (5%):    3.20 ct    Aggregator fee (3%):  1.92 ct
Remaining for solar owners: 58.88 ct

Alice 30%: 17.66    Bob 30%: 17.66    Carol 10%: 5.89    Dave 20%: 11.78    Eve 10%: 5.89
```

**Battery revenue (BATTERY): 30.00 ct**

```
Community fee (5%):    1.50 ct    Aggregator fee (3%):  0.90 ct
Remaining for battery owners: 27.60 ct

Alice 25%: 6.90    Bob 25%: 6.90    Dave 25%: 6.90    Eve 25%: 6.90
```

Carol earns nothing from battery — she has 0% battery ownership. Import balance: 25.00 ct.

### Energy Credit balances

```
               Charged     Earned      Balance
Alice:         -16.00      +24.56      +8.56 ct    ← credit (under-consumed)
Bob:           -64.00      +24.56      -39.44 ct   ← debt (over-consumed)
Carol:          -8.00       +5.89      -2.11 ct    ← small debt
Dave:          -31.00      +18.68      -12.32 ct   ← debt
Eve:             0.00      +12.79      +12.79 ct   ← credit (investor)
Community:        —         +4.70      +4.70 ct
Aggregator:       —         +2.82      +2.82 ct
Import:           —           —        +25.00 ct
                                       ─────────
                               Zero-sum: 0.00 ✓
```

**Positive** = Energy Credits (ERC-20 token). **Negative** = debt, settled with EURC stablecoin.

---

## Export Example

Sunny afternoon, low consumption. Solar: 10 kWh at 8 ct. Battery idle (no battery revenue this interval).

```
Alice: 2 kWh │ Bob: 2 kWh │ Carol: 1 kWh │ Dave: 1 kWh │ Eve: 0 kWh
Total: 6 kWh │ Surplus: 4 kWh → exported at 5 ct/kWh (feed-in tariff from API)
```

Everyone has more than their solar share. No deficits, no redistribution. 4 kWh exported.

```
settleInterval([
  { device: Alice,   amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Bob,     amount: 2.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Carol,   amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Dave,    amount: 1.0 kWh, price: 8 ct, source: LOCAL  },
  { device: Export,  amount: 4.0 kWh, price: 5 ct, source: LOCAL  },
])
```

Export is just another entry. Solar revenue pot: 48 (consumption) + 20 (export) = 68 ct. Battery idle — no battery revenue.

```
Community (5%): 3.40    Aggregator (3%): 2.04    Solar owners: 62.56

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

When production exceeds consumption, almost everyone earns. Carol has a small debt because her 10% solar ownership earns less than what she paid for her 1 kWh (and she has no battery ownership to supplement).
