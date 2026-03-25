# EnergyPPA Contract

## What it does

One function settles an energy community every 15 minutes. Members consume energy, get charged, and the revenue is split between the community, the aggregator (Hypha Energy), and the member/investors.

## How it works

There is one core function: `consumeEnergy(readings)`.

Each reading says: **who** consumed, **how much**, at **what price**, from **what source** (local or import).

```
consumeEnergy([
  { deviceId: 101, quantity: 30, pricePerKwh: 10, source: LOCAL  },   // Alice
  { deviceId: 201, quantity: 40, pricePerKwh: 10, source: LOCAL  },   // Bob
  { deviceId: 201, quantity: 20, pricePerKwh: 25, source: IMPORT },   // Bob (grid)
  { deviceId: 301, quantity: 10, pricePerKwh: 10, source: LOCAL  },   // Carol
  { deviceId: 999, quantity: 10, pricePerKwh: 0,  source: LOCAL  },   // Export
])
```

The contract does two things:

**Step 1 — Charge consumers.** Each member is debited `qty × price`. LOCAL charges are added to a revenue pot. IMPORT charges go to the import balance.

**Step 2 — Split the revenue pot.**

```
Revenue pot (all LOCAL charges + export revenue)
  │
  ├── Community fee %   → community address
  ├── Aggregator fee %  → aggregator address (Hypha Energy)
  └── Remainder         → members/investors by ownership %
```

## Example

**Setup:**
- Alice (40% ownership), Bob (40%), Carol (20%)
- Community fee: 5%, Aggregator fee: 3%

**Readings this interval:**
- Alice: 30 kWh LOCAL @ 10¢ → charged 300
- Bob: 40 kWh LOCAL @ 10¢ → charged 400
- Bob: 20 kWh IMPORT @ 25¢ → charged 500
- Carol: 10 kWh LOCAL @ 10¢ → charged 100

**Revenue pot** (LOCAL only): 300 + 400 + 100 = **800**

**Split:**
- Community (5%): 40
- Aggregator (3%): 24
- Remaining for owners: 736
  - Alice (40%): 294
  - Bob (40%): 294
  - Carol (20%): 148

**Net balances after this interval:**
- Alice: −300 + 294 = **−6**
- Bob: −400 − 500 + 294 = **−606**
- Carol: −100 + 148 = **+48**
- Community address: **+40**
- Aggregator address: **+24**
- Import balance: **+500**

**Zero-sum:** −6 − 606 + 48 + 40 + 24 + 500 = **0**

## Sources

| Source | What happens |
|---|---|
| **LOCAL** | Consumer charged. Revenue goes to pot → split between community, aggregator, owners. |
| **IMPORT** | Consumer charged. Goes to import balance (external cost). |
| **Export** (export device) | Revenue added to pot → split same way. |

LOCAL includes solar, battery, and any community-owned production. The backend computes the appropriate price and passes it in the reading.

## Revenue split

| Recipient | Configured via | What they get |
|---|---|---|
| **Community** | `setCommunityAddress` + `setCommunityFeeBps` | % of local revenue, before owner split |
| **Aggregator** (Hypha Energy) | `setAggregatorAddress` + `setAggregatorFeeBps` | % of local revenue, before owner split |
| **Members/investors** | `ownershipBps` per member | Remainder split by ownership % |

Fees are in basis points (10000 = 100%). Community + aggregator fees cannot exceed 100%. Ownership is separate — members split whatever remains after fees.

## Members

Each member has:
- **Wallet address** and **device IDs** (smart meter identifiers)
- **Ownership %** — their share of local revenue after fees (basis points, 10000 = 100%)
- **Metadata hash** — IPFS link to full details (legal info, location, etc.)

## Balances

- **Positive** = credit (stored as ERC-20 EnergyToken, visible in wallets)
- **Negative** = debt (stored internally)
- Members settle debt by sending stablecoin (EURC/EURe) via `settleOwnDebt(amount)`
- Zero-sum is verified after every `consumeEnergy` call — includes all member balances, community, aggregator, import, export, and settled balances

## Files

```
contracts/
├── EnergyPPAImplementation.sol       ← the contract
├── EnergyToken.sol                   ← ERC-20 for positive balances
├── interfaces/IEnergyPPA.sol         ← types and events
└── storage/EnergyPPAStorage.sol      ← state variables
```

## Tokenomics: Energy Credit Scenarios

### Scenario A — One token per community (current design)

Each community deploys its own EnergyToken. Alice's community has `ENERGY-AMS`, Bob's community in Porto has `ENERGY-PRT`. The tokens are isolated.

```
Community Amsterdam        Community Porto
┌──────────────────┐      ┌──────────────────┐
│  ENERGY-AMS      │      │  ENERGY-PRT      │
│  1 token = 1¢    │      │  1 token = 1¢    │
│  Only usable     │      │  Only usable     │
│  inside this     │      │  inside this     │
│  community       │      │  community       │
└──────────────────┘      └──────────────────┘
```

**Pros:** Simple. Each community is self-contained. No external dependencies.

**Cons:** No network effects. A token from Amsterdam is worthless in Porto. No reason for communities to connect. No secondary market. No incentive for new communities to join a larger network.

---

### Scenario B — One shared token across all communities

Every community uses the same `ENERGY` token. When any community settles local consumption, it mints/moves the same token. A credit earned in Amsterdam is spendable in Porto.

```
                    Shared ENERGY token
                   ┌──────────────────────┐
                   │                      │
    Community A ───┤   Total supply =     ├─── Community C
    Community B ───┤   sum of all local   ├─── Community D
                   │   revenue across     │
                   │   all communities    │
                   └──────────────────────┘
```

This creates something interesting: **demand for the token**.

#### How supply actually works

Credits are created when local revenue is distributed to owners (positive balances = ERC-20 tokens). Credits are NOT burned when debt is settled — settlement just moves a negative balance toward zero. The person with debt never held tokens.

So supply only grows. Every interval adds credits equal to the total local revenue. The only time tokens disappear is if a member with a positive balance is removed or via emergency reset.

This means: **the token is NOT naturally scarce.** Supply = cumulative local revenue across all communities, forever growing. By itself, this doesn't create a price above 1 eurocent.

#### Could it trade above 1 EURC anyway?

Honestly, only with an external demand driver. The contract itself creates exactly as many credits as there is consumption, so supply meets demand by construction. Here are the realistic options, ranked by honesty:

**1. Speculation (most likely initial driver)**

People buy the token betting that the energy community network will grow and future demand will increase. This is how most tokens work in practice. It's not backed by a fundamental supply shortage — it's a bet on adoption. Could work for bootstrapping but is not sustainable alone.

**2. Governance rights (real but modest)**

If holding energy credits gives voting power over community decisions (pricing, new member approval, investment in new solar capacity), then the token has value beyond settlement. People would acquire tokens for influence, not just energy. This creates buy pressure outside the energy settlement loop.

**3. Staking requirements (engineered scarcity)**

Require communities to stake energy credits to join the network (e.g., 10,000 credits locked per community). Require members to stake to activate their membership. This locks tokens out of circulation, creating artificial scarcity. The more communities join, the more tokens are locked.

**4. Cross-community trading (secondary market)**

Alice in Amsterdam has +500 credits. Bob in Porto has -600 debt. If Alice can sell her credits to Bob directly (peer-to-peer), that creates a market. The price depends on whether there are more sellers (under-consumers) or buyers (over-consumers with debt) at any given time. But since the contract always accepts 1 credit = 1 eurocent for settlement, the floor is fixed.

**5. External demand (the real unlock)**

If entities outside energy communities want the token — for example, companies buying energy credits for carbon accounting, ESG reporting, or renewable energy proof — then there's demand that doesn't come from the settlement loop. This is the only way to create sustained price above par without artificial mechanics.

#### The real demand driver: Aggregator buyback

Hypha Energy (the aggregator) receives a % of credits from every community. In Scenario A (separate tokens), those credits are only useful within that one community. In Scenario B (shared token), Hypha can do something powerful:

```
Every 15 minutes, across ALL communities:
  │
  ├── Community A settles → Hypha gets 3% in ENERGY credits
  ├── Community B settles → Hypha gets 3% in ENERGY credits
  ├── Community C settles → Hypha gets 3% in ENERGY credits
  │
  ▼
Hypha accumulates ENERGY credits
  │
  ├── Swaps some credits for EURC (via settlement or OTC)
  │
  ▼
Hypha uses EURC to buy ENERGY tokens on the open market
  │
  ▼
Buy pressure on ENERGY token → price rises above 1 eurocent
```

**Why this works:**

1. **Constant buy pressure.** Every community that joins adds to Hypha's credit flow. Hypha converts a portion to EURC and uses it to buy tokens on the market. The more communities, the more buy pressure. This is structural, not speculative.

2. **Flywheel for new communities.** When a new community joins, their members/investors receive ENERGY credits as owner distributions. If the market price is above 1 eurocent (say 1.3 eurocent), those credits are worth more than their face value. This makes ownership in an energy community more attractive → more communities want to join → more buy pressure.

3. **Investors hold instead of selling.** If Bob owns 20% of a community and receives 200 credits per interval, he might NOT swap them for EURC if he believes the token will appreciate. This reduces sell pressure. Fewer sellers + Hypha buying = price goes up.

4. **Self-reinforcing cycle:**

```
More communities join
       │
       ▼
Hypha earns more credits across all communities
       │
       ▼
Hypha buys more ENERGY tokens on the market
       │
       ▼
Token price rises above 1 eurocent
       │
       ▼
Existing member credits are worth more
       │
       ▼
Joining a community becomes more attractive
       │
       └──────── more communities join ◄──────┘
```

5. **Only works with one shared token.** In Scenario A, Hypha gets tokens from Community A that are useless in Community B. There's no single market to buy from, no network-wide price, no flywheel. The shared token is what connects everything.

**In practice, each member has a choice:**
- Settle debt with EURC at the fixed rate (1 credit = 1 eurocent) → predictable, safe
- Hold credits and bet on appreciation → speculative, potentially more valuable
- Sell credits on the open market at market price → if price > 1 eurocent, they profit

The aggregator buyback ensures there's always a buyer on the market. Members/investors who believe in the network's growth have a reason to hold rather than sell. Those who need liquidity can always settle at par.

#### The honest assessment

| Driver | Sustainable? | Realistic? |
|---|---|---|
| Speculation | No | Yes (short term) |
| Governance | Somewhat | Yes, if governance matters |
| Staking requirements | Artificial | Yes, easy to implement |
| Cross-community trading | Maybe | Yes, natural market |
| External demand (ESG/carbon) | Yes | Uncertain, depends on regulation |

A shared token across communities is valuable for **network effects and liquidity** (one market instead of many isolated ones), but it doesn't automatically trade above 1 EURC. For that, you need either engineered scarcity (staking) or external demand (ESG buyers). Speculation can bootstrap but doesn't last.

The safest design: keep the token pegged at 1 credit = 1 eurocent for energy settlement, and let any premium come from optional secondary markets. Don't promise appreciation — promise utility.

#### Risks

- **Regulatory.** A token that trades above par may be classified as a financial instrument under MiCAR. A utility token with a fixed settlement rate is safer.
- **Volatility.** If the token price swings on secondary markets, members might hold credits hoping for appreciation instead of settling bills, distorting the energy accounting.
- **Supply bloat.** Without any burn or decay mechanism, total supply grows forever. Over years, this dilutes any scarcity effect.

#### Implementation difference

Scenario A (current): each `initialize()` deploys/references its own EnergyToken. No changes needed.

Scenario B (shared): all communities reference the same EnergyToken address. The token contract authorizes multiple community contracts. A lightweight registry contract tracks which communities are in the network.

```
Scenario A                          Scenario B
┌─────────────┐                    ┌─────────────┐
│ Community A  │──► Token A        │ Community A  │──┐
└─────────────┘                    └─────────────┘  │
┌─────────────┐                    ┌─────────────┐  ├──► Shared ENERGY token
│ Community B  │──► Token B        │ Community B  │──┤
└─────────────┘                    └─────────────┘  │
┌─────────────┐                    ┌─────────────┐  │
│ Community C  │──► Token C        │ Community C  │──┘
└─────────────┘                    └─────────────┘
```

The contract code is identical in both scenarios. The only difference is whether each community gets its own EnergyToken or they all share one.

---

## Deployment

1. Deploy EnergyToken
2. Deploy EnergyPPAImplementation via UUPS proxy
3. `initialize(owner, energyToken, stablecoin, paymentRecipient)`
4. `energyToken.setAuthorized(proxyAddress, true)`
5. `updateWhitelist(backendAddress, true)`
6. `setCommunityAddress(addr)` + `setCommunityFeeBps(500)` (e.g. 5%)
7. `setAggregatorAddress(addr)` + `setAggregatorFeeBps(300)` (e.g. 3%)
8. `setExportDeviceId(deviceId)` + `setExportPrice(price)`
9. `addMember(address, deviceIds, ownershipBps, metadataHash)` for each member
10. Backend calls `consumeEnergy(readings)` every 15 minutes
