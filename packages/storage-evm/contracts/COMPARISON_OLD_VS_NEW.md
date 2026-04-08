# Old vs New: EnergyDistributionImplementation vs EnergyPPAImplementation

## The same community, same consumption, different contracts

**Members:**
- Alice: 40% ownership, device 101
- Bob: 40% ownership, device 201
- Carol: 20% ownership, device 301
- Export device: 999

**This interval (all prices set by backend):**
- Solar produced: 100 kWh, backend sets price at 5 eurocents/kWh
- Grid imported: 50 kWh, backend sets price at 25 eurocents/kWh
- Alice consumed: 30 kWh
- Bob consumed: 60 kWh
- Carol consumed: 10 kWh
- Exported: 10 kWh, export price configured at 8 eurocents/kWh

---

## Old contract: EnergyDistributionImplementation

Two function calls per interval. Backend sets the price per source.

### Call 1: distributeEnergyTokens

```
sources: [
  { sourceId: 1, price: 5, quantity: 100, isImport: false },   // backend sets 5¢
  { sourceId: 2, price: 25, quantity: 50, isImport: true }     // backend sets 25¢
]
```

Creates a pool:

| # | Owner | Price | Qty |
|---|---|---|---|
| 1 | Alice | 5 | 40 |
| 2 | Bob | 5 | 40 |
| 3 | Carol | 5 | 20 |
| 4 | (import) | 25 | 50 |

### Call 2: consumeEnergyTokens

```
readings: [
  { deviceId: 999, quantity: 10 },   // export
  { deviceId: 101, quantity: 30 },   // Alice
  { deviceId: 201, quantity: 60 },   // Bob
  { deviceId: 301, quantity: 10 },   // Carol
]
```

**Exports processed first** (10 kWh from cheapest pool entries):
- Takes 10 from Alice's pool entry (price 5)
- Revenue = 10 × 8 (export price) = 80
- Cost = 10 × 5 = 50
- Alice gets profit: 80 − 50 = 30
- Community gets cost: 50
- Export balance: −80
- Alice's pool entry: 40 → 30

**Alice consumes 30 kWh:**
- Pass 1 (own tokens): takes 30 from her remaining 30 @ price 5
- Cost = 30 × 5 = 150 → community
- Alice pays: **−150**

**Bob consumes 60 kWh:**
- Pass 1 (own tokens): takes 40 from his pool @ price 5
- Cost = 40 × 5 = 200 → community
- Pass 2 (others, cheapest first): needs 20 more
  - Carol has 10 left @ price 5 → takes 10, cost 50 → Carol gets 50
  - Import has 50 @ price 25 → takes 10, cost 250 → import balance
- Bob pays: **−(200 + 50 + 250) = −500**

**Carol consumes 10 kWh:**
- Pass 1 (own tokens): takes 10 from her remaining 10 @ price 5
- Cost = 10 × 5 = 50 → community
- Carol pays: **−50**

### Old contract result

| Account | Balance | How |
|---|---|---|
| Alice | −150 + 30 (export profit) = **−120** | Paid 150, earned 30 from export |
| Bob | **−500** | Heavy consumer + imports |
| Carol | −50 + 50 (surplus sold) = **0** | Break even |
| Community | 50 + 150 + 200 + 50 = **+450** | Self-consumption + export cost |
| Import | +250 | Bob's grid import |
| Export | −80 | Energy sold to grid |
| **Total** | **0** | Zero-sum ✓ |

**Price everyone pays for local energy: 5 eurocents/kWh** (= production cost).
Community (investors/treasury) earns 450. This is just the production cost flowing back — no margin.

---

## New contract: EnergyPPAImplementation

One function call per interval. Backend sets the price per reading. Community fee: 5%, Aggregator fee: 3%.

### Call: consumeEnergy

```
readings: [
  { deviceId: 999, quantity: 10, pricePerKwh: 8,  source: LOCAL  },  // export @ 8¢
  { deviceId: 101, quantity: 30, pricePerKwh: 10, source: LOCAL  },  // Alice @ 10¢
  { deviceId: 201, quantity: 40, pricePerKwh: 10, source: LOCAL  },  // Bob local @ 10¢
  { deviceId: 201, quantity: 20, pricePerKwh: 25, source: IMPORT },  // Bob grid @ 25¢
  { deviceId: 301, quantity: 10, pricePerKwh: 10, source: LOCAL  },  // Carol @ 10¢
]
```

**Step 1 — Charge consumers:**
- Export (device 999): uses configured exportPrice = 10 × 8 = 80 → revenue pot, export balance −80
- Alice: 30 × 10 = 300 → revenue pot. Alice pays −300
- Bob local: 40 × 10 = 400 → revenue pot. Bob pays −400
- Bob import: 20 × 25 = 500 → import balance. Bob pays −500
- Carol: 10 × 10 = 100 → revenue pot. Carol pays −100

**Revenue pot:** 80 + 300 + 400 + 100 = **880**

**Step 2 — Split revenue pot:**
- Community (5%): 880 × 5% = 44
- Aggregator (3%): 880 × 3% = 26
- Remaining for owners: 880 − 44 − 26 = 810
  - Alice (40%): 324
  - Bob (40%): 324
  - Carol (20%): 162

### New contract result

| Account | Balance | How |
|---|---|---|
| Alice | −300 + 324 = **+24** | Consumed less value than she earned as owner |
| Bob | −400 − 500 + 324 = **−576** | Heavy consumer + imports |
| Carol | −100 + 162 = **+62** | Consumed less value than she earned |
| Community | **+44** | 5% fee |
| Aggregator | **+26** | 3% fee |
| Import | **+500** | Bob's grid import |
| Export | **−80** | Energy sold to grid |
| **Total** | **0** | Zero-sum ✓ |

**Price for local energy: 10 eurocents/kWh** (set by backend, CommunityGenerationPrice).
Owners share 810 out of 880 revenue. Community and aggregator take their cut.

---

## Side by side

| | Old (EnergyDistribution) | New (EnergyPPA) |
|---|---|---|
| **Functions per interval** | 2 (distribute + consume) | 1 (consumeEnergy) |
| **Price source** | From pool entry (set by backend) | From consumption reading (set by backend) |
| **Local kWh price** | 5¢ (production cost only) | 10¢ (market rate) |
| **Alice pays** | 150 | 300 |
| **Bob pays** | 500 | 900 |
| **Carol pays** | 50 | 100 |
| **Alice net balance** | −120 | **+24** (credit!) |
| **Bob net balance** | −500 | −576 |
| **Carol net balance** | 0 | **+62** (credit!) |
| **Community gets** | 450 (production cost) | 44 (5% fee) |
| **Aggregator gets** | — (not built in) | 26 (3% fee) |
| **Owners get** | — (mixed into community) | 810 (direct to wallets) |
| **Contract lines** | ~950 | ~500 |
| **Pool storage** | Yes (PoolEntry array + sorting) | No |
| **Surplus logic** | On-chain (own first, cheapest next) | None (revenue shared by ownership %) |

## The key difference in one sentence

**Old:** Backend sets the price per source. That price is what everyone pays. Revenue goes to a community pot. Under-consumers earn only when someone else buys their surplus.

**New:** Backend sets the price per consumption reading. Revenue is split — fees to community and aggregator, rest directly to owners by ownership %. Under-consumers automatically earn more than they pay because their owner share exceeds their consumption.
