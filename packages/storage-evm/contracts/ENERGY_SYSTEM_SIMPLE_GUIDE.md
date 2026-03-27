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
   (30%)  (30%)  (20%)  (community  (community    meter
                  (20%) owned)      owned)
```

- 3 households: Alice, Bob, Carol (they consume electricity)
- 1 solar park: produces electricity for the community
- 1 battery: stores excess solar energy for later use
- Grid connection: imports electricity when solar + battery aren't enough

Ownership percentages (30%, 30%, 20%, 20%) determine each member's share of the solar energy and revenue.

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

---

### Step 3 — Every 15 minutes: summarize the readings

**What happens:** A scheduled job runs every 15 minutes (at :00, :15, :30, :45). It looks at all the raw readings from the past 15 minutes and calculates one summary number per meter: how many kWh were produced or consumed in that window.

**Simple example (14:00–14:15 interval):**

```
Meter        │ 15-min total  │ Meaning
─────────────┼───────────────┼────────────────────
Alice        │ 1.5 kWh used  │ Alice consumed 1.5 kWh
Bob          │ 3.0 kWh used  │ Bob consumed 3.0 kWh
Carol        │ 0.5 kWh used  │ Carol consumed 0.5 kWh
Solar park   │ 5.0 kWh made  │ Solar produced 5.0 kWh
Battery      │ 0.5 kWh out   │ Battery discharged 0.5 kWh
Grid         │ 0.0 kWh       │ Nothing imported from grid
```

**Check:** Production (5.0 solar + 0.5 battery) = Consumption (1.5 + 3.0 + 0.5) = 5.5 kWh. Balanced — no grid needed this interval.

**Technology:**
- Same database: **TimescaleDB** (a scheduled query aggregates the raw data)
- Scheduler: **pg_cron** (built into PostgreSQL) or a simple **cron job**

**Where the data lives:** TimescaleDB, table called `interval_readings`. Kept forever — this is the official record of what happened.

---

### Step 4 — The EMS backend calculates who pays what

This is the brain of the system. The EMS (Energy Management System) is a backend program that takes the 15-minute summaries, looks at the community's rules, and figures out the fair split.

**What it reads:**

| Data | Where it comes from |
|---|---|
| How much each household consumed | `interval_readings` database (Step 3) |
| How much solar was produced | `interval_readings` database (Step 3) |
| Each member's ownership % | The blockchain contract |
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


**The calculation (three simple passes):**

Let's use a slightly different interval where grid import is needed:

```
Solar produced: 4.0 kWh (at CommunityGenerationPrice = 8 ct/kWh)
Battery discharged: 0.0 kWh
Alice consumed: 1.5 kWh
Bob consumed: 3.0 kWh
Carol consumed: 0.5 kWh
Total consumed: 5.0 kWh
Shortfall: 5.0 - 4.0 = 1.0 kWh must come from grid (at CommunityRetailerImportPrice = 25 ct/kWh)
```

**Pass 1 — Each member gets their ownership share of solar.**

```
                Ownership    Share of 4.0 kWh    Needs     Covered?
Alice (30%):    30%          1.2 kWh             1.5 kWh   No → 0.3 kWh short
Bob   (30%):    30%          1.2 kWh             3.0 kWh   No → 1.8 kWh short
Carol (20%):    20%          0.8 kWh             0.5 kWh   Yes → 0.3 kWh surplus
Dave  (20%):    20%          0.8 kWh             0.0 kWh   Yes → 0.8 kWh surplus
```

(Dave is an investor — he owns 20% but doesn't consume. His share goes to surplus.)

**Pass 2 — Leftover solar goes to members who need more (split by ownership %).**

```
Total surplus: 0.3 + 0.8 = 1.1 kWh
Members who need more: Alice (30% owner, short 0.3) and Bob (30% owner, short 1.8)
Their combined ownership: 30 + 30 = 60%

Alice gets: 1.1 × (30/60) = 0.55 kWh extra solar
  But Alice only needs 0.3 more → gets 0.3, rest goes back to pool
Bob gets: remaining 0.8 kWh extra solar

Updated shortfalls:
  Alice: 0.3 - 0.3 = 0.0 (fully covered by solar)
  Bob:   1.8 - 0.8 = 1.0 kWh still needed
```

**Pass 3 — Whatever's left comes from the grid.**

```
Bob still needs 1.0 kWh → imported from grid at 25 ct/kWh
```

**Final bills for this 15-minute interval:**

```
                Solar kWh    Solar cost     Grid kWh    Grid cost     Total cost
Alice:          1.5          12.0 ct        0.0         0.0 ct        12.0 ct
Bob:            2.0          16.0 ct        1.0         25.0 ct       41.0 ct
Carol:          0.5           4.0 ct        0.0         0.0 ct         4.0 ct
Dave:           0.0           0.0 ct        0.0         0.0 ct         0.0 ct
                ─────        ──────         ─────       ──────        ──────
Total:          4.0 kWh      32.0 ct        1.0 kWh    25.0 ct       57.0 ct
```

Check: 4.0 × 8 + 1.0 × 25 = 32 + 25 = 57 ct. Correct.

Alice and Carol pay only 8 ct/kWh because their consumption fits within solar. Bob pays a mix: 8 ct for his solar share, 25 ct for the grid portion. Dave pays nothing because he consumed nothing (but he'll earn revenue from the revenue split on-chain).

**Technology:**
- Backend: **Node.js** or **Python** service
- Cloud options: **AWS Lambda**, **Google Cloud Functions**, or a simple **Docker container**
- Scheduling: Runs immediately after Step 3 completes

**Where the data lives:** The EMS saves its calculation to PostgreSQL, table called `settlement_batches`. This is the receipt — it records exactly what was sent to the blockchain and why.

---

### Step 5 — The blockchain records the settlement

**What happens:** The EMS backend sends one transaction to the smart contract on the blockchain. The contract does the financial accounting: charge each consumer, collect fees, distribute revenue to owners.

**What the backend sends:**

```
consumeEnergy([
  { device: Alice,  amount: 1.5 kWh, price: 8 ct,  source: LOCAL  },
  { device: Bob,    amount: 2.0 kWh, price: 8 ct,  source: LOCAL  },
  { device: Bob,    amount: 1.0 kWh, price: 25 ct, source: IMPORT },
  { device: Carol,  amount: 0.5 kWh, price: 8 ct,  source: LOCAL  },
])
```

**What the contract does:**

Step A — Charge each consumer:

```
Alice is charged: 1.5 × 8  = 12 ct
Bob is charged:   2.0 × 8 + 1.0 × 25 = 41 ct
Carol is charged: 0.5 × 8  = 4 ct
```

Step B — Split the LOCAL revenue (32 ct) among fees and owners:

```
LOCAL revenue: 12 + 16 + 4 = 32 ct

Community fee (5%):   32 × 5%  = 1.6 ct  → community treasury
Aggregator fee (3%):  32 × 3%  = 0.96 ct → Hypha Energy (the operator)
Remaining for owners: 32 - 1.6 - 0.96 = 29.44 ct

  Alice (30%): 29.44 × 30% =  8.83 ct earned
  Bob   (30%): 29.44 × 30% =  8.83 ct earned
  Carol (20%): 29.44 × 20% =  5.89 ct earned
  Dave  (20%): 29.44 × 20% =  5.89 ct earned
```

Step C — Net balance (what each member owes or is owed):

```
              Charged    Earned     Net
Alice:        -12.00     +8.83      -3.17 ct  (owes 3.17 ct)
Bob:          -41.00     +8.83      -32.17 ct (owes 32.17 ct)
Carol:         -4.00     +5.89      +1.89 ct  (earns 1.89 ct)
Dave:           0.00     +5.89      +5.89 ct  (earns 5.89 ct)
Community:      —        +1.60      +1.60 ct
Aggregator:     —        +0.96      +0.96 ct
Import:         —          —        +25.00 ct

Total: -3.17 - 32.17 + 1.89 + 5.89 + 1.60 + 0.96 + 25.00 = 0.00  ✓
```

Everything sums to zero. The contract verifies this — if it doesn't balance, the transaction is rejected.

**Technology:**
- Blockchain: **Gnosis Chain** (low fees, euro-friendly) or **Base** / **Polygon**
- Contract: `EnergyPPAImplementation.sol` (already built)
- Backend wallet: The EMS has an Ethereum wallet that is whitelisted to call the contract

**Where the data lives:** On the blockchain permanently. Balances are stored in the smart contract. Events (logs of what happened) are stored in the blockchain's transaction history. Positive balances (like Carol's +1.89 ct) become **EnergyToken** (an ERC-20 token visible in any crypto wallet).

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
| "Alice used 1.5 kWh this interval" | **TimescaleDB** (Step 3) | Summing 90 raw readings is a database job |
| "Alice's solar share is 1.2 kWh" | **Backend EMS** (Step 4) | Needs ownership % from blockchain + meter data from database |
| "Alice pays 8 ct/kWh for solar, Bob pays 25 ct for grid" | **Backend EMS** (Step 4) | Needs the price catalogue + the three-pass algorithm |
| "Charge Alice 12 ct, credit her 8.83 ct" | **Blockchain** (Step 5) | Financial settlement must be tamper-proof |
| "Community gets 5% fee = 1.60 ct" | **Blockchain** (Step 5) | Fee split is enforced by the smart contract |
| "All balances sum to zero" | **Blockchain** (Step 5) | The contract rejects the transaction if it doesn't balance |
| "Bob pays 15.20 EURC to clear his debt" | **Blockchain** (Step 6) | Real money movement must be on a public ledger |
