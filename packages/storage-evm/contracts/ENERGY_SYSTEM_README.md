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
         (30%)  (30%)  (10%)  (20%)  (10%) Park
```

- **Alice, Bob, Carol, Dave** — four households that consume electricity.
- **Eve** — an investor. She owns 10% of the solar park but does not live in the community and does not consume any electricity. She earns revenue from her ownership.
- **Solar park** — produces electricity from sunlight for the community.
- **Battery** — stores excess solar energy and releases it later.
- **Grid** — the national electricity network. Used when solar + battery aren't enough.

The percentages represent how much of the solar park each member owns. They determine both the share of cheap energy you receive and the share of revenue you earn.

---

## Part 1 — From Meters to Bills: The Technical Pipeline

Every member, the solar park, the battery, and the grid connection each have a smart meter. Think of a smart meter as a tiny computer strapped to the wire that counts how much electricity flows through it.

Here is what happens, step by step, every 15 minutes.

### Step 1: Meters send readings

Every 10 seconds, each smart meter sends a small message: "Right now, 1.2 kW is flowing through me."

These messages travel over the internet using a lightweight protocol called **MQTT** — a messaging system designed for small devices. The messages arrive at a central **MQTT broker** (think of it as a post office for meter data).

**Where the data lives:** Nowhere permanently. Messages exist in the broker's memory for a moment, then are delivered and gone — like a phone call.

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

### Step 4: The EMS calculates who pays what

This is the brain of the system. The **EMS** (Energy Management System) is a backend program that does two things:

1. **Controls the battery** — it sends charge/discharge commands to the battery over MQTT. This is the only physical action the software takes. Everything else is just accounting.

2. **Runs the fair-split algorithm** — it takes the 15-minute summaries, looks up the community's rules, and calculates exactly how much energy each member should be attributed and at what price. (Part 2 of this document explains this algorithm in detail.)

**What the EMS reads:**

| Data | Where it comes from |
|---|---|
| How much each household consumed | `interval_readings` in TimescaleDB (Step 3) |
| How much the solar park produced | `interval_readings` in TimescaleDB (Step 3) |
| Each member's ownership percentage | The blockchain smart contract |
| Prices for solar, battery energy | The blockchain — set when the community created its PPAs (Power Purchase Agreements) |
| Prices for grid import/export | External APIs — e.g. energy retailer tariffs or spot market prices |

**What the EMS produces:** A list of readings — one per member per energy source — that says who consumed how much, from what source, at what price. This is the input for the blockchain.

**Database:** The EMS saves its calculation to **PostgreSQL**, table called `settlement_batches`. This is the receipt — a record of exactly what was sent to the blockchain and why. Kept forever.

### Step 5: The blockchain records the settlement

The EMS sends its list of readings to a **smart contract** on the blockchain in a single transaction. Here is what that data looks like for the interval above:

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

A member can appear multiple times — once for each energy source at a different price. The source tag tells the contract where the energy came from: LOCAL (solar), BATTERY, or IMPORT (grid). For the revenue split, LOCAL and BATTERY charges both flow into the same revenue pot — only IMPORT is treated differently (it goes to the import balance, which represents the community's bill to the external grid).

The smart contract processes these readings in two steps:

**Step A — Charge each consumer.** Multiply amount × price and debit the member.

**Step B — Split the revenue.** All LOCAL and BATTERY charges flow into a revenue pot. The contract takes a community fee and an aggregator (operator) fee, then distributes the remainder to all members by their ownership percentage — including Eve, who didn't consume anything but still earns her 10% share.

The contract also runs a safety check: every cent charged to someone must appear as a credit somewhere else. If the math doesn't add up to zero, the entire transaction is rejected.

**Where the data lives:** On the blockchain, permanently. Balances are stored in the smart contract. Positive balances become visible as **Energy Credits** (an ERC-20 token) in members' crypto wallets.

### Step 6: Members settle with real money

Over time, members who consume more than they earn accumulate debt. Members who own a large share but consume little accumulate credits. Periodically, members pay their debt using digital euros (a stablecoin like EURC).

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
  │  Charges consumers, distributes revenue, verifies zero-sum
  ▼
Member balances (on-chain), settled with EURC stablecoin
```

---

## Part 2 — Inside the EMS: How Energy Is Fairly Divided

The EMS runs a three-step algorithm every 15 minutes. The goal: give each member their fair share of cheap solar energy before anyone has to buy expensive grid electricity — based on how much of the solar park they own.

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
```

Solar and battery have different prices because the battery price includes a markup for wear and storage costs. The algorithm always uses the cheapest source first: solar (8 ct), then battery (15 ct), then grid (25 ct).

### Step 1 — Give each member their ownership share

Each member gets their percentage of each energy source separately.

```
Solar (8 kWh at 8 ct/kWh):
                 Ownership    Solar share
Alice (30%):     30%          2.4 kWh
Bob   (30%):     30%          2.4 kWh
Carol (10%):     10%          0.8 kWh
Dave  (20%):     20%          1.6 kWh
Eve   (10%):     10%          0.8 kWh

Battery (2 kWh at 15 ct/kWh):
                 Ownership    Battery share
Alice (30%):     30%          0.6 kWh
Bob   (30%):     30%          0.6 kWh
Carol (10%):     10%          0.2 kWh
Dave  (20%):     20%          0.4 kWh
Eve   (10%):     10%          0.2 kWh
```

Each member consumes their cheapest share (solar) first, then battery. Compare what they **need** vs. what they **have**:

```
                 Solar    Battery    Total share    Needs    Result
Alice:           2.4      0.6        3.0 kWh        2.0     Surplus: 1.0 kWh
Bob:             2.4      0.6        3.0 kWh        5.0     Deficit: 2.0 kWh
Carol:           0.8      0.2        1.0 kWh        1.0     Perfect fit
Dave:            1.6      0.4        2.0 kWh        3.0     Deficit: 1.0 kWh
Eve:             0.8      0.2        1.0 kWh        0.0     Surplus: 1.0 kWh
```

Alice used less than her share — she only needed 2.0 kWh of her 3.0. Since she uses solar first, she consumes 2.0 kWh of solar and has **0.4 kWh solar + 0.6 kWh battery** left over.

Eve consumed nothing. Her entire share is surplus: **0.8 kWh solar + 0.2 kWh battery**.

Bob and Dave consumed more than their share. They need more energy.

### Step 2 — Redistribute surplus by ownership, cheapest source first

The surplus from Alice and Eve goes to the members who need more — **split proportionally by their ownership**, not first-come-first-served. Since solar and battery have different prices, surplus is distributed one source at a time, cheapest first.

Deficit members: Bob (30% ownership) and Dave (20% ownership). Their combined ownership is 50%.

**First, distribute the solar surplus (0.4 from Alice + 0.8 from Eve = 1.2 kWh at 8 ct/kWh):**

```
Bob gets:   1.2 × (30/50) = 0.72 kWh of solar
Dave gets:  1.2 × (20/50) = 0.48 kWh of solar
```

**Then, distribute the battery surplus (0.6 from Alice + 0.2 from Eve = 0.8 kWh at 15 ct/kWh):**

```
Bob gets:   0.8 × (30/50) = 0.48 kWh of battery
Dave gets:  0.8 × (20/50) = 0.32 kWh of battery
```

This is the key idea: **surplus is divided proportionally based on ownership**. A member who owns more of the solar park gets a bigger share of any leftover energy. Each source keeps its own price — the cheap solar surplus stays at 8 ct, and the pricier battery surplus stays at 15 ct. This is fair and predictable — it doesn't matter what order the computer processes people in.

After redistribution:

```
                 Solar kWh       Battery kWh       Total has    Still needs
Alice:           2.0             —                  2.0          0.0
Bob:             2.4 + 0.72      0.6 + 0.48        4.2          0.8
Carol:           0.8             0.2                1.0          0.0
Dave:            1.6 + 0.48      0.4 + 0.32        2.8          0.2
Eve:             —               —                  0.0          0.0
```

### Step 3 — Remaining deficit comes from the grid

Bob still needs 0.8 kWh. Dave still needs 0.2 kWh. That's 1.0 kWh total — exactly the shortfall. This comes from the grid at the expensive import price (25 ct/kWh).

### The final bill

```
             Solar          Battery         Grid          Total cost
             kWh    cost    kWh    cost     kWh   cost
Alice:       2.00   16.0    —       —       —      —      16.00 ct
Bob:         3.12   25.0    1.08   16.2     0.8   20.0    61.16 ct
Carol:       0.80    6.4    0.20    3.0     —      —       9.40 ct
Dave:        2.08   16.6    0.72   10.8     0.2    5.0    32.44 ct
Eve:         —       —      —       —       —      —       0.00 ct
             ────          ────            ────           ──────
Total:       8.00          2.00            1.00           119.00 ct
```

Check: 8 × 8 + 2 × 15 + 1 × 25 = 64 + 30 + 25 = 119 ct. Correct.

Alice pays only for solar because she consumed less than her share. Carol pays for both solar and battery — her small ownership means her share is just enough. Bob pays the most because he consumed the most and needed expensive grid electricity. Eve pays nothing — she's an investor.

### What happens on-chain: the settlement

The EMS sends the readings above to the smart contract. The contract does two things:

**1. Charge each consumer.** Every reading gets multiplied out: amount × price. LOCAL and BATTERY charges go into a revenue pot. IMPORT charges go to the import balance.

```
Revenue pot (LOCAL + BATTERY):
  Alice:  2.00 × 8           = 16.00
  Bob:    3.12 × 8 + 1.08 × 15 = 41.16
  Carol:  0.80 × 8 + 0.20 × 15 =  9.40
  Dave:   2.08 × 8 + 0.72 × 15 = 27.44
                                 ──────
  Total revenue:                 94.00 ct

Import balance:
  Bob:    0.80 × 25           = 20.00
  Dave:   0.20 × 25           =  5.00
                                ──────
  Total import:                 25.00 ct
```

**2. Split the revenue pot.** The community fee and aggregator fee come out first, then the rest goes to all members by ownership percentage.

```
Revenue pot:                           94.00 ct

Community fee (5%):   94.00 × 5%  =    4.70 ct  → community treasury
Aggregator fee (3%):  94.00 × 3%  =    2.82 ct  → operator (Hypha Energy)
Remaining for owners:                  86.48 ct

Distributed by ownership:
  Alice (30%):  86.48 × 30% = 25.94 ct
  Bob   (30%):  86.48 × 30% = 25.94 ct
  Carol (10%):  86.48 × 10% =  8.65 ct
  Dave  (20%):  86.48 × 20% = 17.30 ct
  Eve   (10%):  86.48 × 10% =  8.65 ct
```

### On-chain Energy Credit balances after this interval

Each member's balance = what they earned (revenue share) minus what they were charged (consumption). The contract stores these on the blockchain.

```
               Charged     Earned      Balance     Meaning
Alice:         -16.00      +25.94      +9.94 ct    Credit (community owes Alice)
Bob:           -61.16      +25.94      -35.22 ct   Debt (Bob owes community)
Carol:          -9.40       +8.65      -0.75 ct    Debt (small)
Dave:          -32.44      +17.30      -15.14 ct   Debt (Dave owes community)
Eve:             0.00       +8.65      +8.65 ct    Credit (pure investor earnings)

Community:        —         +4.70      +4.70 ct    Fee income
Aggregator:       —         +2.82      +2.82 ct    Operator fee income
Import:           —           —        +25.00 ct   Grid electricity bill
```

**Zero-sum check:** +9.94 − 35.22 − 0.75 − 15.14 + 8.65 + 4.70 + 2.82 + 25.00 = **0.00**

Everything balances. The contract verifies this — if it doesn't sum to zero, the entire transaction is rejected.

**What the balances mean:**

- **Positive balance** (Alice, Eve) → stored as **Energy Credits** (an ERC-20 token visible in any crypto wallet). The community owes them money. Alice earned more from her ownership share than she spent on electricity. Eve earned purely from ownership.
- **Negative balance** (Bob, Carol, Dave) → stored as internal debt. They consumed more than they earned. They'll settle this debt later by paying stablecoin (EURC).
- **Community & Aggregator** → fee income that accumulates over time.
- **Import balance** → the community's electricity bill to the external grid. Paid separately to the energy retailer.

### Why this is better than the old system

The previous on-chain system processed members sequentially in a loop. It built a pool of energy sorted by price, then let each member consume from it one by one. The problem: **array order determined who got cheap energy**.

If Alice was first in the array, she'd eat the cheap solar entries before anyone else. If she was last, those entries were already taken and she'd be stuck paying grid prices. Same community, same production, same consumption — but a member's bill could swing by over 100% just by reordering the input array.

The old system also used a single price for all local energy. There was no way to give solar a different price than battery. In reality, battery energy costs more (wear, storage losses), and members should see that reflected in their bills.

The new system solves both problems:
- **Fair distribution** — surplus is split proportionally by ownership, not sequentially. Every member's cost depends only on how much they consumed, how much they own, and how much energy was available. Not on their position in a list.
- **Per-source pricing** — solar, battery, and grid each carry their own price. The algorithm uses the cheapest source first, and each kWh keeps the price of its actual source all the way through to the bill.

---

## Example 2 — What happens when the community produces more than it needs (export)

Sometimes the solar park produces more electricity than all members consume. The surplus is sold back to the grid. On the blockchain, the export is treated as just another "consumer" — the export device — that takes the leftover energy.

**This interval's numbers:**

```
Solar park produced:    10 kWh   (at 8 ct/kWh — from the PPA)
Battery:                idle

Alice consumed:          2 kWh
Bob consumed:            2 kWh
Carol consumed:          1 kWh
Dave consumed:           1 kWh
Eve consumed:            0 kWh   (investor)
Total consumed:          6 kWh

Surplus:  10 - 6 = 4 kWh → exported to grid (at 5 ct/kWh — feed-in tariff from API)
```

It's a sunny afternoon and nobody is home. The community produces way more than it uses.

### Step 1 — Give each member their ownership share

```
Solar (10 kWh at 8 ct/kWh):
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
  { device: Export,  amount: 4.0 kWh, price: 5 ct                 },
])
```

The export is just another line in the list. The smart contract processes it the same way — the export revenue goes into the revenue pot alongside the consumption charges.

### The money

```
LOCAL consumption charges:  (2 + 2 + 1 + 1) × 8  = 48.00 ct
Export revenue:             4 × 5                  = 20.00 ct
                                                    ───────
Total revenue pot:                                   68.00 ct

Community fee (5%):    68.00 × 5%  =  3.40 ct
Aggregator fee (3%):   68.00 × 3%  =  2.04 ct
Remaining for owners:                 62.56 ct

Owner distribution:
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

When production exceeds consumption, almost everyone earns a credit. The export revenue — money the grid owes the community for the surplus electricity — gets pooled together with consumption charges and distributed to all owners. Even Eve, who didn't consume anything, earns 6.26 ct from her 10% ownership.

Carol is the only one with a small debt (-1.74 ct) because her 10% ownership share earns less revenue than the 8 ct/kWh she paid for her 1 kWh of solar. Larger owners like Alice and Dave earn more from the revenue split than they paid for their consumption.
