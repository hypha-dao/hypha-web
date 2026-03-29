# Energy Distribution & Consumption — How It Works

## The Big Idea

A community shares a solar installation. Each member owns a percentage of it. Every interval (e.g. every 15 minutes), two things happen in order:

1. **Distribute** — the system records how much energy was produced and splits it among members.
2. **Consume** — the system records how much each member actually used and settles the costs.

All accounting is **zero-sum**: every cent one member pays, another member (or the community) receives.

---

## Step 1: Distribute

The system receives a list of energy sources. Each source has a **quantity** (kWh), a **price** (cost per kWh), and a flag saying whether it is **local production** or **grid import**.

### Local production

Split among all members by their **ownership percentage**.
Each member's share goes into a shared pool (called the "collective consumption" pool), tagged with that member's address and the production cost.

### Grid import

Added to the same pool but tagged with **no owner** (`address(0)`). This energy is available for anyone to buy at import price.

### After distribution the pool is sorted cheapest-first.

---

## Step 2: Consume

Each member's smart meter reports how many kWh they used. The system processes consumption in **two passes**:

### Pass 1 — Eat your own food first

The member consumes from pool entries **they own**. The payment goes to the community account (since the member is both buyer and seller, the net effect is a small community fee at production cost).

### Pass 2 — Buy from others (cheapest first)

If the member still needs more energy, they buy from the remaining pool — other members' shares or grid imports — **starting from the cheapest source**.

- Buying from **another member**: that member gets credited.
- Buying from **grid import** (address(0)): the payment goes into the import balance (the community's external electricity bill).

The member's balance is **debited** by the total cost of everything they consumed.

---

## Example

### Setup

| Member | Ownership | Device |
|--------|-----------|--------|
| Alice  | 50 %      | D1     |
| Bob    | 30 %      | D2     |
| Carol  | 20 %      | D3     |

### Distribution

Two energy sources arrive this interval:

| Source         | Quantity | Price  | Import? |
|----------------|----------|--------|---------|
| Solar panels   | 100 kWh  | 2 ¢/kWh | No     |
| Grid import    | 40 kWh   | 10 ¢/kWh | Yes    |

Local production is split by ownership:

| Pool entry | Owner | Qty     | Price  |
|------------|-------|---------|--------|
| #1         | Alice | 50 kWh  | 2 ¢    |
| #2         | Bob   | 30 kWh  | 2 ¢    |
| #3         | Carol | 20 kWh  | 2 ¢    |
| #4         | —     | 40 kWh  | 10 ¢   |

Pool is sorted by price (already sorted here).

Total available: **140 kWh**.

### Consumption

| Member | Actually used |
|--------|---------------|
| Alice  | 30 kWh        |
| Bob    | 30 kWh        |
| Carol  | 80 kWh        |

Total consumed: **140 kWh** (matches available).

#### Alice (30 kWh needed)

- **Pass 1** — she owns 50 kWh at 2 ¢. She eats 30 kWh of her own. Done.
- Cost: 30 × 2 ¢ = **60 ¢**
- She **pays 60 ¢**. Community account receives 60 ¢.
- 20 kWh of her share is left over in the pool for others.

#### Bob (30 kWh needed)

- **Pass 1** — he owns 30 kWh at 2 ¢. He eats all 30. Done.
- Cost: 30 × 2 ¢ = **60 ¢**
- He **pays 60 ¢**. Community account receives 60 ¢.

#### Carol (80 kWh needed — heavy user!)

- **Pass 1** — she owns 20 kWh at 2 ¢. She eats all 20. Still needs 60 kWh.
- **Pass 2** — cheapest remaining first:
  - Alice's leftover: 20 kWh at 2 ¢ → takes all 20. Alice gets **credited 40 ¢**.
  - Grid import: 40 kWh at 10 ¢ → takes all 40. Import balance receives **400 ¢**.
- Total cost: (20 × 2) + (20 × 2) + (40 × 10) = 40 + 40 + 400 = **480 ¢**
- She **pays 480 ¢**.

### Final balances after this interval

| Account              | Balance  | Why                                        |
|----------------------|----------|--------------------------------------------|
| Alice                | **−20 ¢** | Paid 60 ¢, received 40 ¢ from Carol        |
| Bob                  | **−60 ¢** | Paid 60 ¢, received nothing                |
| Carol                | **−480 ¢**| Paid 480 ¢, received nothing               |
| Community account    | **+160 ¢**| Received self-consumption fees              |
| Import balance       | **+400 ¢**| Grid energy debt the community owes utility |

Check: (−20) + (−60) + (−480) + 160 + 400 = **0**. Zero-sum holds.

---

## Is This Fair?

**Yes, with a clear trade-off.**

### What makes it fair

- **You eat your own food first.** If you produce enough for yourself, you only pay the cheap solar cost — not the grid price.
- **Cheapest energy is consumed first.** When you need more than your share, the system gives you the cheapest available source before the expensive one.
- **Sellers get paid.** If Alice produces more than she uses, and Carol buys that surplus, Alice receives money. Producers are rewarded for under-consuming.

### What happens to the over-consumer

Carol owns 20 % of the panels but used 80 kWh out of 140. She ran through her own cheap share fast, then had to buy from others — and eventually from the expensive grid import.

The more you over-consume relative to your ownership share, the more you pay, and the more of that cost comes from expensive imported energy. This is by design: **the grid import is the most expensive source, and heavy consumers bear that cost**.

### When does a member pay?

Members don't pay cash on-chain in real time. Instead the contract tracks a **cash credit balance** for each member:

- **Positive balance** = the community owes you money (you produced more than you consumed).
- **Negative balance** = you owe the community money (you consumed more than you produced).

These balances accumulate over many intervals. Periodically, a separate **settlement** process collects real payments from members with negative balances to zero out their debt.

---

## Summary

| Concept | One-liner |
|---------|-----------|
| Distribute | Split local production by ownership %, add imports to shared pool |
| Consume | Use your own share first, then buy cheapest remaining |
| Over-consumer | Ends up buying expensive grid imports, pays more |
| Under-consumer | Surplus is sold to others, earns credit |
| Import energy | Available to anyone, but at grid price — last resort |
| Zero-sum | Every payment has a matching receipt somewhere in the system |
