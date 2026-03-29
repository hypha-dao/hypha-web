# Merit-Order: Old vs. New Contract

Why the old system is unfair, and how the new one fixes it.

---

## Setup (same for both examples)

4 members, 1 solar park, grid import available.

| Member | Device | Ownership | Consumption this interval |
|---|---|---|---|
| Alice | 101 | 30% | 3 kWh |
| Bob | 201 | 30% | 5 kWh |
| Carol | 301 | 20% | 1 kWh |
| Dave | 401 | 20% | 3 kWh |

Energy sources this interval (all prices set by backend):
- **Solar:** 8 kWh at **8 cents/kWh**
- **Battery discharge:** 2 kWh at **15 cents/kWh**
- Total local: 10 kWh

Total demand: 3 + 5 + 1 + 3 = **12 kWh**.

Shortfall: 12 - 10 = **2 kWh** must be imported from grid at **25 cents/kWh**.

Community fee: 5%. Aggregator fee: 3%.

---

## Part 1: The Old System (EnergyDistributionImplementation)

### How it works

Two separate contract calls per interval:

```
TX 1: distributeEnergyTokens(sources, batteryState)
TX 2: consumeEnergyTokens(consumptionRequests)
```

**TX 1 builds a pool.** The contract takes each energy source, splits it by ownership %, and creates pool entries:

```
Source: Solar (8 kWh at 8¢, local)

  Alice (30%): 2.4 kWh at 8¢  → pool entry, owner=Alice
  Bob   (30%): 2.4 kWh at 8¢  → pool entry, owner=Bob
  Carol (20%): 1.6 kWh at 8¢  → pool entry, owner=Carol
  Dave  (20%): 1.6 kWh at 8¢  → pool entry, owner=Dave

Source: Battery (2 kWh at 15¢, local)

  Alice (30%): 0.6 kWh at 15¢ → pool entry, owner=Alice
  Bob   (30%): 0.6 kWh at 15¢ → pool entry, owner=Bob
  Carol (20%): 0.4 kWh at 15¢ → pool entry, owner=Carol
  Dave  (20%): 0.4 kWh at 15¢ → pool entry, owner=Dave

Source: Grid import (2 kWh at 25¢, import)

  → pool entry, owner=address(0)  (community-owned, no specific member)
```

The contract sorts the pool by price (cheapest first):

```
Pool after sorting:
  [0] Alice:  2.4 kWh at  8¢
  [1] Bob:    2.4 kWh at  8¢
  [2] Carol:  1.6 kWh at  8¢
  [3] Dave:   1.6 kWh at  8¢
  [4] Alice:  0.6 kWh at 15¢
  [5] Bob:    0.6 kWh at 15¢
  [6] Carol:  0.4 kWh at 15¢
  [7] Dave:   0.4 kWh at 15¢
  [8] Import: 2.0 kWh at 25¢
```

**TX 2 processes consumption.** The contract loops through each consumption request sequentially. For each member:

- **Pass 1:** Eat your own pool entries first (self-consumption).
- **Pass 2:** Buy from others' entries, cheapest first. The pool **depletes** as you go.

### The problem: array order determines price

The backend decides the order of `consumptionRequests[]`. Whoever is processed first gets the cheapest remaining energy.

**Order A: [Alice, Bob, Carol, Dave]**

```
Alice (needs 3 kWh, processed 1st):
  Pass 1: eats own entries [0] 2.4 at 8¢ + [4] 0.6 at 15¢ = 3.0 kWh. Done.
  Cost: 2.4 × 8 + 0.6 × 15 = 28.2¢

Bob (needs 5 kWh, processed 2nd):
  Pass 1: eats own entries [1] 2.4 at 8¢ + [5] 0.6 at 15¢ = 3.0 kWh. Needs 2 more.
  Pass 2 (cheapest first): Carol's solar [2] 1.6 at 8¢ → takes 1.6. Needs 0.4 more.
          Carol's battery [6] 0.4 at 15¢ → takes 0.4. Done.
  Cost: 2.4 × 8 + 0.6 × 15 + 1.6 × 8 + 0.4 × 15 = 47.0¢

Carol (needs 1 kWh, processed 3rd):
  Pass 1: own entries [2] and [6] are empty (Bob took them). Gets 0.
  Pass 2: Dave's solar [3] 1.6 at 8¢ → takes 1.0. Done.
  Cost: 1.0 × 8 = 8.0¢

Dave (needs 3 kWh, processed 4th):
  Pass 1: own entries [3] has 0.6 left at 8¢ + [7] 0.4 at 15¢ = 1.0 kWh. Needs 2 more.
  Pass 2: only import [8] left → takes 2.0 at 25¢. Done.
  Cost: 0.6 × 8 + 0.4 × 15 + 2.0 × 25 = 60.8¢
```

| Member | Consumption | Cost | Avg price/kWh |
|---|---|---|---|
| Alice | 3 kWh | 28.2¢ | 9.4¢ |
| Bob | 5 kWh | 47.0¢ | 9.4¢ |
| Carol | 1 kWh | 8.0¢ | 8.0¢ |
| Dave | 3 kWh | **60.8¢** | **20.3¢** |

Dave pays 20.3¢/kWh. Carol gets lucky at 8¢. Dave is stuck with all the grid import because he's last in the array.

**Order B: [Dave, Carol, Bob, Alice]**

```
Dave (needs 3 kWh, processed 1st):
  Pass 1: eats own [3] 1.6 at 8¢ + [7] 0.4 at 15¢ = 2.0 kWh. Needs 1 more.
  Pass 2: Alice's solar [0] 2.4 at 8¢ → takes 1.0. Done.
  Cost: 1.6 × 8 + 0.4 × 15 + 1.0 × 8 = 26.8¢

Carol (needs 1 kWh, processed 2nd):
  Pass 1: eats own [2] 1.0 at 8¢. Done. (surplus: 0.6 solar + 0.4 battery)
  Cost: 1.0 × 8 = 8.0¢

Bob (needs 5 kWh, processed 3rd):
  Pass 1: eats own [1] 2.4 at 8¢ + [5] 0.6 at 15¢ = 3.0 kWh. Needs 2 more.
  Pass 2: Alice's solar [0] 1.4 left at 8¢ → takes 1.4. Carol's solar [2] 0.6 at 8¢ → takes 0.6. Done.
  Cost: 2.4 × 8 + 0.6 × 15 + 1.4 × 8 + 0.6 × 8 = 42.6¢

Alice (needs 3 kWh, processed 4th):
  Pass 1: own [0] is empty, own [4] 0.6 at 15¢ → takes 0.6. Needs 2.4 more.
  Pass 2: Carol's battery [6] 0.4 at 15¢ → takes 0.4. Needs 2.0 more.
          Import [8] 2.0 at 25¢ → takes 2.0. Done.
  Cost: 0.6 × 15 + 0.4 × 15 + 2.0 × 25 = 65.0¢
```

| Member | Consumption | Cost (Order A) | Cost (Order B) | Difference |
|---|---|---|---|---|
| Alice | 3 kWh | 28.2¢ | **65.0¢** | **+130%** |
| Bob | 5 kWh | 47.0¢ | 42.6¢ | −9% |
| Carol | 1 kWh | 8.0¢ | 8.0¢ | 0% |
| Dave | 3 kWh | **60.8¢** | 26.8¢ | −56% |

Same community. Same production. Same consumption. The backend just changed the array order — and Alice's bill swings from 28.2¢ to 65.0¢. With three price tiers (solar 8¢, battery 15¢, grid 25¢), the ordering problem gets worse because there's more price variance in the pool.

### Why self-consumption doesn't save you

Pass 1 (self-consumption) only helps if your demand fits within your own entitlement. Here:

| Member | Entitlement (solar + battery) | Demand | Covered by own? |
|---|---|---|---|
| Alice | 2.4 + 0.6 = 3.0 kWh | 3.0 kWh | Yes — protected |
| Bob | 2.4 + 0.6 = 3.0 kWh | 5.0 kWh | No — needs 2 more from pool |
| Carol | 1.6 + 0.4 = 2.0 kWh | 1.0 kWh | Yes — protected |
| Dave | 1.6 + 0.4 = 2.0 kWh | 3.0 kWh | No — needs 1 more from pool |

Alice and Carol are safe in both orderings because their demand fits within their entitlement. But Bob and Dave both need more than they own — and whoever is processed last in the array gets the expensive leftovers. With battery in the mix, the price spread is wider (8¢ to 25¢ across three tiers), making the ordering problem worse.

### Could the old system be made fair?

Yes, but it would require rewriting the consumption loop. Instead of sequential depletion:

**Option 1: Ownership-weighted surplus split.** After self-consumption (pass 1), calculate total remaining surplus and total remaining deficit across all members. Each deficit member gets a share of surplus proportional to their ownership percentage (not deficit size). This is order-independent but requires two loops instead of one — the contract would need to first compute all surpluses/deficits and ownership totals, then distribute.

**Option 2: Equal price blending.** After self-consumption, all remaining energy (others' surplus + import) gets a single blended price. Every deficit member pays the same blended rate. Simple but penalizes light overconsumers — someone who needs 0.1 kWh extra pays the same rate as someone who needs 5 kWh extra.

**Option 3: Move the logic off-chain.** This is what the new system does.

---

## Part 2: The New System (EnergyPPAImplementation)

### How it works

One contract call per interval:

```
TX: consumeEnergy(readings)
```

The backend computes the fair attribution **before** calling the contract. The contract receives pre-computed readings with price and source already set. It doesn't run any merit-order logic — it just does the financial math.

### What the backend computes (the three-pass algorithm)

The backend reads the meters and the contract's configuration, then runs this:

```
INPUTS (from meters and contract):
  Solar production:   8 kWh at  8¢/kWh
  Battery discharge:  2 kWh at 15¢/kWh
  Total local:       10 kWh
  Grid import:        2 kWh at 25¢/kWh (= total demand - local)
  Members:           Alice 30%, Bob 30%, Carol 20%, Dave 20%
  Demand:            Alice 3, Bob 5, Carol 1, Dave 3
```

The backend runs a merit-order algorithm: cheapest source first (solar → battery → grid).

**PASS 1 — Ownership entitlement (solar first, then battery).**

Each member gets their ownership % of each source. They consume the lesser of entitlement or demand, cheapest source first.

```
Solar entitlement (8 kWh):
  Alice: 2.4    Bob: 2.4    Carol: 1.6    Dave: 1.6

Battery entitlement (2 kWh):
  Alice: 0.6    Bob: 0.6    Carol: 0.4    Dave: 0.4

Total entitlement:
  Alice: 3.0    Bob: 3.0    Carol: 2.0    Dave: 2.0
```

Consume cheapest first within entitlement:

```
                Solar used   Battery used   Total LOCAL   Surplus   Deficit
Alice (3.0):    2.4          0.6            3.0           0.0       0.0
Bob   (5.0):    2.4          0.6            3.0           0.0       2.0
Carol (1.0):    1.0          0.0            1.0           1.0       0.0
Dave  (3.0):    1.6          0.4            2.0           0.0       1.0
                                                          ───       ───
                                                          1.0       3.0
```

Carol only needs 1.0 of her 2.0 entitlement. Her surplus: 0.6 solar + 0.4 battery.

**PASS 2 — Redistribute surplus by ownership (cheapest first).**

Carol's 1.0 kWh surplus goes to deficit members by ownership %.

```
Deficit members: Bob (30%), Dave (20%)  →  combined 50%

Bob gets:   1.0 × 30/50 = 0.6 kWh  (Carol's surplus solar at 8¢)
Dave gets:  1.0 × 20/50 = 0.4 kWh  (Carol's surplus battery at 15¢)
```

Updated state:

```
                Solar consumed   Battery consumed   Total LOCAL   Remaining deficit
Alice:          2.4              0.6                3.0           0.0
Bob:            2.4 + 0.6       0.6                3.6           1.4
Carol:          1.0              0.0                1.0           0.0
Dave:           1.6              0.4 + 0.4         2.4           0.6
```

**PASS 3 — Remaining deficit = grid import.**

Bob needs 1.4 more, Dave needs 0.6 more. That's 2.0 kWh — exactly the grid import.

```
            Solar kWh   Battery kWh   Import kWh   Solar cost   Battery cost   Import cost   Total
Alice:      2.4         0.6           —            19.20¢       9.00¢          —             28.20¢
Bob:        3.0         0.6           1.4          24.00¢       9.00¢          35.00¢        68.00¢
Carol:      1.0         —             —             8.00¢       —              —              8.00¢
Dave:       1.6         0.8           0.6          12.80¢      12.00¢          15.00¢        39.80¢
            ────        ────          ────         ──────       ──────         ──────        ──────
Total:      8.0         2.0           2.0          64.00¢      30.00¢          50.00¢       144.00¢
```

Verify: 8 × 8 + 2 × 15 + 2 × 25 = 64 + 30 + 50 = 144. Checks out.

**This result is the same regardless of array order.** Every member's cost depends only on their own consumption, their own entitlement, and global totals — not on position in an array.

### What the backend sends to the contract

The backend builds a `ConsumptionReading[]` from the three-pass result. Each source type becomes a separate reading:

```
consumeEnergy([
  { deviceId: 101, quantity: 2400, pricePerKwh:  8, source: LOCAL  },  // Alice: 2.4 solar
  { deviceId: 101, quantity:  600, pricePerKwh: 15, source: LOCAL  },  // Alice: 0.6 battery
  { deviceId: 201, quantity: 3000, pricePerKwh:  8, source: LOCAL  },  // Bob: 3.0 solar
  { deviceId: 201, quantity:  600, pricePerKwh: 15, source: LOCAL  },  // Bob: 0.6 battery
  { deviceId: 201, quantity: 1400, pricePerKwh: 25, source: IMPORT },  // Bob: 1.4 grid
  { deviceId: 301, quantity: 1000, pricePerKwh:  8, source: LOCAL  },  // Carol: 1.0 solar
  { deviceId: 401, quantity: 1600, pricePerKwh:  8, source: LOCAL  },  // Dave: 1.6 solar
  { deviceId: 401, quantity:  800, pricePerKwh: 15, source: LOCAL  },  // Dave: 0.8 battery
  { deviceId: 401, quantity:  600, pricePerKwh: 25, source: IMPORT },  // Dave: 0.6 grid
])
```

A member can have multiple readings — one for each source.

### What the contract does

The contract does NOT know about solar panels, ownership entitlements, surplus redistribution, or merit-order. It receives the readings above and executes two steps:

**Step 1 — Charge each consumer.**

For each reading: `charge = quantity × pricePerKwh`. Debit the member.

```
Alice: 2400 × 8 + 600 × 15                      = 28200   → balance -= 28200
Bob:   3000 × 8 + 600 × 15 + 1400 × 25          = 68000   → balance -= 68000
Carol: 1000 × 8                                  =  8000   → balance -=  8000
Dave:  1600 × 8 + 800 × 15 + 600 × 25           = 39800   → balance -= 39800
```

LOCAL charges go to the revenue pot. IMPORT charges go to `importCashCreditBalance`.

```
LOCAL revenue pot:
  Alice: 28200 + Bob: (24000 + 9000) + Carol: 8000 + Dave: (12800 + 12000) = 94000
Import balance:
  Bob: 35000 + Dave: 15000 = 50000
Total charged: 94000 + 50000 = 144000
```

Verify: 8 × 8 + 2 × 15 + 2 × 25 = 64 + 30 + 50 = 144 (in cents). Matches at scale ×1000.

**Step 2 — Split the LOCAL revenue pot.**

```
Revenue pot: 94000

Community fee (5%):   94000 × 5%  = 4700   → communityAddress
Aggregator fee (3%):  94000 × 3%  = 2820   → aggregatorAddress
Remaining: 94000 - 4700 - 2820 = 86480

Owner distribution (by ownership %):
  Alice (30%):  86480 × 30% = 25944  → Alice balance += 25944
  Bob   (30%):  86480 × 30% = 25944  → Bob balance += 25944
  Carol (20%):  86480 × 20% = 17296  → Carol balance += 17296
  Dave  (20%):  86480 × 20% = 17296  → Dave balance += 17296
```

**Net balances after this interval:**

```
                Charged     Revenue share    Net balance
Alice:         -28200       +25944           -2256
Bob:           -68000       +25944           -42056
Carol:          -8000       +17296           +9296
Dave:          -39800       +17296           -22504
Community:         —        +4700            +4700
Aggregator:        —        +2820            +2820
Import:            —           —             +50000

Zero-sum check:
  -2256 - 42056 + 9296 - 22504 + 4700 + 2820 + 50000 = 0  ✓
```

The revenue pot is larger (94000 vs 80000 in a solar-only scenario) because battery energy costs more than solar. This means owners get a bigger distribution. Carol ends up with more credit (+9296) because the battery revenue lifts everyone's ownership payout.

**How battery fits in:** The backend assigns each kWh its source price (solar 8¢, battery 15¢, grid 25¢). The contract doesn't know or care about source types — it just sees LOCAL readings at different prices. All LOCAL charges go to the same revenue pot and get distributed to owners equally. Battery energy is more expensive, so it generates more revenue for owners, but also costs more for the consumers who receive it. The merit-order algorithm (off-chain) ensures cheaper solar is used first.

---

## What is computed where

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (off-chain)                      │
│                                                                 │
│  Reads from meters:                                             │
│    Alice consumed 3 kWh, Bob consumed 5 kWh, etc.               │
│    Solar produced 10 kWh, grid imported 2 kWh                   │
│                                                                 │
│  Reads from contract (via RPC):                                 │
│    Alice 30%, Bob 30%, Carol 20%, Dave 20%                      │
│    Community fee 5%, Aggregator fee 3%                          │
│    Local price 8, Import price 25                               │
│                                                                 │
│  Computes (three-pass algorithm):                               │
│    PASS 1: entitlement = ownership% × totalLocal                │
│            localConsumed = min(entitlement, demand)              │
│            surplus = entitlement - localConsumed                 │
│            deficit = demand - localConsumed                      │
│                                                                 │
│    PASS 2: redistribute surplus → deficit proportionally        │
│                                                                 │
│    PASS 3: remaining deficit = IMPORT                           │
│                                                                 │
│  Builds ConsumptionReading[] with deviceId, qty, price, source  │
│                                                                 │
│  Submits one transaction: consumeEnergy(readings)               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        CONTRACT (on-chain)                      │
│                                                                 │
│  Receives readings. For each one:                               │
│    charge = quantity × pricePerKwh                              │
│    debit the member                                             │
│    if LOCAL → add to revenue pot                                │
│    if IMPORT → add to importCashCreditBalance                   │
│                                                                 │
│  Split revenue pot:                                             │
│    community fee % → communityAddress                           │
│    aggregator fee % → aggregatorAddress                         │
│    remainder → each member by ownership %                       │
│                                                                 │
│  Verify zero-sum (ensureZeroSum modifier):                      │
│    Σ all balances + import + export + settled = 0               │
│    if not → revert entire transaction                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What the backend decides vs. what the contract enforces

| Decision | Who makes it | Can it be gamed? |
|---|---|---|
| How much did each member consume? | Backend (from meters) | Yes — backend could submit false readings |
| How much local energy was available? | Backend (from solar meter) | Yes — backend could inflate/deflate |
| What price does each kWh get? | Backend (three-pass algorithm) | No ordering bias — algorithm is deterministic given inputs |
| How is LOCAL revenue split? | Contract (ownership % + fees) | No — hardcoded in contract logic |
| Does the math balance to zero? | Contract (ensureZeroSum) | No — reverts if violated |
| Who gets community/aggregator fees? | Contract (configured addresses + bps) | No — set by contract owner |

The backend controls the inputs. The contract enforces the financial rules on those inputs. The trust boundary is at the data layer (are the meter readings real?), not the computation layer.

---

## Side-by-side comparison

| | Old (EnergyDistribution) | New (EnergyPPA) |
|---|---|---|
| **Transactions per interval** | 2 (distribute + consume) | 1 (consumeEnergy) |
| **Merit-order runs** | On-chain (sequential pool depletion) | Off-chain (three-pass, simultaneous) |
| **Array order matters?** | Yes — determines who gets cheap energy | No — each reading has its price baked in |
| **Fair to overconsumers?** | No — last in array pays most | Yes — deficit members split import proportionally |
| **Multiple price tiers (solar/battery/grid)?** | Pool sorts by price but ordering bias gets worse | Each reading carries its own price — no bias |
| **Gas cost (4 members)** | ~200k (pool + sort + 2-pass consume) | ~100k (simple loop + revenue split) |
| **Gas cost (50 members)** | ~5M+ (may hit block limit) | ~500k |
| **Backend trust** | Must trust consumption array AND ordering | Must trust meter readings AND prices |
| **Contract complexity** | ~950 lines, debug events, bubble sort | ~515 lines, clean |
