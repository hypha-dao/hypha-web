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

Solar park produced: **10 kWh** at **8 cents/kWh** (local price).

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
Source: Solar (10 kWh at 8¢, local)

  Alice (30%): 3.0 kWh at 8¢  → pool entry, owner=Alice
  Bob   (30%): 3.0 kWh at 8¢  → pool entry, owner=Bob
  Carol (20%): 2.0 kWh at 8¢  → pool entry, owner=Carol
  Dave  (20%): 2.0 kWh at 8¢  → pool entry, owner=Dave

Source: Grid import (2 kWh at 25¢, import)

  → pool entry, owner=address(0)  (community-owned, no specific member)
```

The contract sorts the pool by price (cheapest first):

```
Pool after sorting:
  [0] Alice:  3.0 kWh at  8¢
  [1] Bob:    3.0 kWh at  8¢
  [2] Carol:  2.0 kWh at  8¢
  [3] Dave:   2.0 kWh at  8¢
  [4] Import: 2.0 kWh at 25¢
```

**TX 2 processes consumption.** The contract loops through each consumption request sequentially. For each member:

- **Pass 1:** Eat your own pool entries first (self-consumption).
- **Pass 2:** Buy from others' entries, cheapest first. The pool **depletes** as you go.

### The problem: array order determines price

The backend decides the order of `consumptionRequests[]`. Whoever is processed first gets the cheapest remaining energy.

**Order A: [Alice, Bob, Carol, Dave]**

```
Alice (needs 3 kWh, processed 1st):
  Pass 1: eats own entry [0] → 3.0 kWh at 8¢. Done.
  Cost: 3.0 × 8 = 24¢

Bob (needs 5 kWh, processed 2nd):
  Pass 1: eats own entry [1] → 3.0 kWh at 8¢. Needs 2 more.
  Pass 2: Carol's entry [2] has 2.0 kWh at 8¢ → takes all 2.0. Done.
  Cost: 5.0 × 8 = 40¢

Carol (needs 1 kWh, processed 3rd):
  Pass 1: own entry [2] is empty (Bob took it). Gets 0.
  Pass 2: Dave's entry [3] has 2.0 kWh at 8¢ → takes 1.0. Done.
  Cost: 1.0 × 8 = 8¢

Dave (needs 3 kWh, processed 4th):
  Pass 1: own entry [3] has 1.0 kWh left → takes 1.0 at 8¢. Needs 2 more.
  Pass 2: only import entry [4] left → takes 2.0 at 25¢. Done.
  Cost: 1.0 × 8 + 2.0 × 25 = 58¢
```

| Member | Consumption | Cost | Avg price/kWh |
|---|---|---|---|
| Alice | 3 kWh | 24¢ | 8.0¢ |
| Bob | 5 kWh | 40¢ | 8.0¢ |
| Carol | 1 kWh | 8¢ | 8.0¢ |
| Dave | 3 kWh | **58¢** | **19.3¢** |

Dave pays 19.3¢/kWh. Everyone else pays 8¢/kWh. Dave is the only one stuck with the expensive grid import.

**Order B: [Dave, Carol, Bob, Alice]**

```
Dave (needs 3 kWh, processed 1st):
  Pass 1: eats own entry [3] → 2.0 kWh at 8¢. Needs 1 more.
  Pass 2: Alice's entry [0] has 3.0 kWh at 8¢ → takes 1.0. Done.
  Cost: 3.0 × 8 = 24¢

Carol (needs 1 kWh, processed 2nd):
  Pass 1: eats own entry [2] → 1.0 kWh at 8¢. Done. (she has surplus of 1.0 left)
  Cost: 1.0 × 8 = 8¢

Bob (needs 5 kWh, processed 3rd):
  Pass 1: eats own entry [1] → 3.0 kWh at 8¢. Needs 2 more.
  Pass 2: Alice's entry [0] has 2.0 kWh left at 8¢ → takes 2.0. Done.
  Cost: 5.0 × 8 = 40¢

Alice (needs 3 kWh, processed 4th):
  Pass 1: own entry [0] is empty (Dave and Bob took it). Gets 0.
  Pass 2: Carol's entry [2] has 1.0 kWh at 8¢ → takes 1.0. Needs 2 more.
           Import entry [4] has 2.0 kWh at 25¢ → takes 2.0. Done.
  Cost: 1.0 × 8 + 2.0 × 25 = 58¢
```

| Member | Consumption | Cost (Order A) | Cost (Order B) | Difference |
|---|---|---|---|---|
| Alice | 3 kWh | 24¢ | **58¢** | **+142%** |
| Bob | 5 kWh | 40¢ | 40¢ | 0% |
| Carol | 1 kWh | 8¢ | 8¢ | 0% |
| Dave | 3 kWh | **58¢** | 24¢ | −59% |

Same community. Same production. Same consumption. The backend just changed the array order — and Alice's bill swings from 24¢ to 58¢.

### Why self-consumption doesn't save you

Pass 1 (self-consumption) only helps if your demand fits within your own entitlement. Here:

| Member | Entitlement | Demand | Covered by own? |
|---|---|---|---|
| Alice | 3.0 kWh | 3.0 kWh | Yes — protected |
| Bob | 3.0 kWh | 5.0 kWh | No — needs 2 more from pool |
| Carol | 2.0 kWh | 1.0 kWh | Yes — protected |
| Dave | 2.0 kWh | 3.0 kWh | No — needs 1 more from pool |

Alice and Carol are safe in both orderings because their demand fits within their entitlement. But Bob and Dave both need more than they own — and whoever is processed last in the array gets the expensive leftovers.

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
  Solar production:  10 kWh
  Grid import:        2 kWh (= total demand - solar)
  Local price:        8¢/kWh (community-agreed, stored on-chain or in config)
  Import price:      25¢/kWh (from grid tariff API)
  Members:           Alice 30%, Bob 30%, Carol 20%, Dave 20%
  Demand:            Alice 3, Bob 5, Carol 1, Dave 3
```

**PASS 1 — Ownership entitlement.**

Each member gets their ownership % of total local production.
They consume the lesser of their entitlement or their demand.

```
                    Entitlement           Demand    Consumes LOCAL    Surplus    Deficit
Alice (30%):    30% × 10 = 3.0 kWh      3.0 kWh   3.0 kWh          0.0        0.0
Bob   (30%):    30% × 10 = 3.0 kWh      5.0 kWh   3.0 kWh          0.0        2.0
Carol (20%):    20% × 10 = 2.0 kWh      1.0 kWh   1.0 kWh          1.0        0.0
Dave  (20%):    20% × 10 = 2.0 kWh      3.0 kWh   2.0 kWh          0.0        1.0
                                                                     ───        ───
                                                    Total:           1.0        3.0
```

Alice consumes exactly her entitlement — fully covered.
Carol only needs 1 of her 2 kWh entitlement — she has 1 kWh surplus.
Bob and Dave need more than their entitlement — they have a deficit.

**PASS 2 — Redistribute surplus by ownership.**

Carol's unused 1.0 kWh goes to members who have a deficit, split by their **ownership percentage** (not by deficit size). Whoever invested more in the community gets a larger share of the surplus.

```
Total surplus:  1.0 kWh
Deficit members: Bob (30% ownership), Dave (20% ownership)
Their combined ownership: 30 + 20 = 50%

Bob gets:   1.0 × (30 / 50) = 0.600 kWh extra LOCAL
Dave gets:  1.0 × (20 / 50) = 0.400 kWh extra LOCAL
```

Why ownership and not deficit size? If we split by deficit, Bob (deficit 2.0) would get 0.667 and Dave (deficit 1.0) would get 0.333. That rewards overconsumption — the more you consume beyond your entitlement, the more cheap surplus you receive. Splitting by ownership rewards investment in the community instead.

Updated state:

```
                    LOCAL consumed    Remaining deficit
Alice:              3.000 kWh         0.000 kWh
Bob:                3.600 kWh         1.400 kWh
Carol:              1.000 kWh         0.000 kWh
Dave:               2.400 kWh         0.600 kWh
```

**PASS 3 — Remaining deficit = grid import.**

Bob still needs 1.400 kWh. Dave still needs 0.600 kWh. That's 2.0 kWh total — exactly matching the grid import.

```
                    LOCAL consumed    IMPORT consumed    LOCAL cost    IMPORT cost    Total cost
Alice:              3.000 kWh         0.000 kWh          24.00¢         0.00¢         24.00¢
Bob:                3.600 kWh         1.400 kWh          28.80¢        35.00¢         63.80¢
Carol:              1.000 kWh         0.000 kWh           8.00¢         0.00¢          8.00¢
Dave:               2.400 kWh         0.600 kWh          19.20¢        15.00¢         34.20¢
                    ──────────        ──────────          ──────        ──────         ──────
Total:             10.000 kWh         2.000 kWh          80.00¢        50.00¢        130.00¢
```

Verify: 10 × 8 + 2 × 25 = 80 + 50 = 130. Checks out.

**This result is the same regardless of array order.** Every member's cost depends only on their own consumption, their own entitlement, and global totals — not on position in an array.

### What the backend sends to the contract

The backend builds a `ConsumptionReading[]` from the three-pass result:

```
consumeEnergy([
  { deviceId: 101, quantity: 3000, pricePerKwh: 8, source: LOCAL  },  // Alice: 3.0 kWh LOCAL
  { deviceId: 201, quantity: 3600, pricePerKwh: 8, source: LOCAL  },  // Bob: 3.6 kWh LOCAL
  { deviceId: 201, quantity: 1400, pricePerKwh: 25, source: IMPORT }, // Bob: 1.4 kWh IMPORT
  { deviceId: 301, quantity: 1000, pricePerKwh: 8, source: LOCAL  },  // Carol: 1.0 kWh LOCAL
  { deviceId: 401, quantity: 2400, pricePerKwh: 8, source: LOCAL  },  // Dave: 2.4 kWh LOCAL
  { deviceId: 401, quantity:  600, pricePerKwh: 25, source: IMPORT }, // Dave: 0.6 kWh IMPORT
])
```

A member can have multiple readings — one for each source.

### What the contract does

The contract does NOT know about solar panels, ownership entitlements, surplus redistribution, or merit-order. It receives the readings above and executes two steps:

**Step 1 — Charge each consumer.**

For each reading: `charge = quantity × pricePerKwh`. Debit the member.

```
Alice: 3000 × 8 = 24000                         → balance -= 24000
Bob:   3600 × 8 + 1400 × 25 = 28800 + 35000     → balance -= 63800
Carol: 1000 × 8 = 8000                           → balance -= 8000
Dave:  2400 × 8 + 600 × 25  = 19200 + 15000      → balance -= 34200
```

LOCAL charges go to the revenue pot. IMPORT charges go to `importCashCreditBalance`.

```
LOCAL revenue pot: 24000 + 28800 + 8000 + 19200 = 80000
Import balance: 35000 + 15000 = 50000
```

**Step 2 — Split the LOCAL revenue pot.**

```
Revenue pot: 80000

Community fee (5%):   80000 × 5%  = 4000   → communityAddress
Aggregator fee (3%):  80000 × 3%  = 2400   → aggregatorAddress
Remaining: 80000 - 4000 - 2400 = 73600

Owner distribution (by ownership %):
  Alice (30%):  73600 × 30% = 22080  → Alice balance += 22080
  Bob   (30%):  73600 × 30% = 22080  → Bob balance += 22080
  Carol (20%):  73600 × 20% = 14720  → Carol balance += 14720
  Dave  (20%):  73600 × 20% = 14720  → Dave balance += 14720
                                       (last member gets remainder to avoid rounding dust)
```

**Net balances after this interval:**

```
                Charged     Revenue share    Net balance
Alice:         -24000       +22080           -1920
Bob:           -63800       +22080           -41720
Carol:          -8000       +14720           +6720
Dave:          -34200       +14720           -19480
Community:         —        +4000            +4000
Aggregator:        —        +2400            +2400
Import:            —           —             +50000

Zero-sum check:
  -1920 - 41720 + 6720 - 19480 + 4000 + 2400 + 50000 = 0  ✓
```

Carol ends up with a positive balance (+6720) because she consumed less than her entitlement — she earns credits. Bob has the largest debt because he consumed the most, including expensive grid import. Alice has a small debt because her consumption exactly matched her entitlement, but fees reduce her revenue share slightly below her charge.

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
| **Gas cost (4 members)** | ~200k (pool + sort + 2-pass consume) | ~100k (simple loop + revenue split) |
| **Gas cost (50 members)** | ~5M+ (may hit block limit) | ~500k |
| **Backend trust** | Must trust consumption array AND ordering | Must trust meter readings AND prices |
| **Contract complexity** | ~950 lines, debug events, bubble sort | ~515 lines, clean |
