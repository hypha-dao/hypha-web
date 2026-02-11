# Backing Vault — How It Works

## What Is It?

The Backing Vault lets a Space **back its community token with real assets** (like USDC, HYPHA, WETH, etc.). Token holders can then **redeem their community tokens for the backing assets** whenever they want.

Think of it like a currency reserve: the Space says _"our token is worth something because there's real value behind it."_

---

## The Core Idea

```
  Community members hold Space Tokens (e.g., "DAO_TOKEN")
                        │
                        ▼
        ┌───────────────────────────────┐
        │         Backing Vault         │
        │                               │
        │   Reserves:                   │
        │     $50,000 USDC              │
        │     10,000 HYPHA              │
        │     2 WETH                    │
        │                               │
        │   Exchange rates:             │
        │     1 DAO_TOKEN → 2 USDC      │
        │     1 DAO_TOKEN → 0.5 HYPHA   │
        │     1 DAO_TOKEN → 0.001 WETH  │
        └───────────────────────────────┘
                        │
                        ▼
  Member sends in 10 DAO_TOKEN, picks USDC → gets 20 USDC
```

**It's one-way only.** Members send community tokens IN (which are **burned permanently**) and get backing tokens OUT.

---

## How It Gets Set Up

### One call does it all

Everything happens through `addBackingToken`. A single proposal can create the vault, add **multiple** backing tokens with their exchange rates, fund each reserve, and set a minimum backing floor — all in one transaction:

> _"Back our token with USDC at 2 USDC/token (deposit 50k) and HYPHA at 0.5 HYPHA/token (deposit 10k), with a 20% minimum backing floor"_

```
addBackingToken(
  spaceId, spaceToken,
  [usdc, hypha],            // backing tokens
  [2_000_000, 500e15],      // exchange rates
  [50_000e6, 10_000e18],    // funding amounts (0 = skip)
  2000                      // 20% minimum backing
)
```

Funding and minimum backing are optional — pass `0` to skip:

- **Full setup**: multiple tokens + funded + minimum floor, all in one proposal
- **Add only**: `addBackingToken(spaceId, token, [usdc], [rate], [0], 0)` → just add USDC, fund later via `addBacking`
- **Add later**: call `addBackingToken` again to add more backing tokens to an existing vault

### After setup: Members can redeem

Any token holder can now send their community tokens to the vault and receive their chosen backing token(s).

### Top up the reserve later

The Space can deposit more backing tokens into the reserve at any time via `addBacking` (requires a proposal through the executor).

---

## Redemption Options

### Option A: Pick one token

_"I want to redeem 100 DAO_TOKEN for USDC"_

→ Member sends 100 DAO_TOKEN, receives 200 USDC

### Option B: Split across multiple tokens

_"I want to redeem 100 DAO_TOKEN — 60% in USDC and 40% in HYPHA"_

→ Member sends 100 DAO_TOKEN, receives:

- 120 USDC (60 tokens × 2 USDC rate)
- 20 HYPHA (40 tokens × 0.5 HYPHA rate)

---

## Who Can Do What

| Action                                                 | Who                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Add backing token (+ optional funding & minimum floor) | Space (via proposal through the executor)                     |
| Remove a backing token                                 | Space (via proposal)                                          |
| Change the exchange rate                               | Space (via proposal)                                          |
| Change the minimum backing threshold                   | Space (via proposal)                                          |
| Fund the reserve with backing tokens                   | Space (via proposal)                                          |
| Redeem community tokens for backing                    | **Any token holder** (optionally restricted to Space members) |
| Withdraw reserves                                      | Space (via proposal)                                          |
| Pause/unpause redemptions                              | Space (via proposal)                                          |

---

## Important Details

### One contract for all Spaces

Every Space uses the same Backing Vault contract. Each Space's reserves are completely separate — Space A's funds can never be accessed by Space B's members.

### Exchange rates are set by the Space

The Space decides what each token is worth in terms of each backing asset. These rates can be updated by proposal at any time.

### What happens to redeemed community tokens?

When a member redeems, their community tokens are **burned** — permanently removed from circulation. This reduces the total supply of the community token, which naturally increases the backing ratio for remaining token holders.

### Reserves can run out

If the reserve runs low, redemptions will fail until more backing is added. The vault never mints or creates backing tokens — it only holds and distributes what's been deposited.

### Minimum backing threshold

The Space can set a **minimum backing percentage** when creating the vault (via `addBackingToken`) or update it later (via `setMinimumBacking`). This is a safety floor that prevents reserves from being drained too low.

**How it works:** Before each redemption, the contract computes the **aggregate coverage** across ALL backing tokens. Each token's reserve is converted to "space token equivalents" using its exchange rate, then summed. If the total coverage after the redemption would fall below the minimum percentage of the remaining supply, the redemption is blocked.

Example: With a 20% minimum (2000 basis points) and 10,000 tokens outstanding:

- USDC reserve: 6,000 USDC at rate 2 USDC/token → covers 3,000 space tokens
- HYPHA reserve: 2,500 HYPHA at rate 0.5 HYPHA/token → covers 5,000 space tokens
- **Total coverage = 8,000 space tokens** (80% of 10,000 supply)
- Required coverage = 20% × 10,000 = 2,000 space tokens
- A member can redeem up to ~6,000 space tokens worth before hitting the floor
- Even if USDC runs low, HYPHA coverage still counts toward the total

The minimum is set in basis points (0–10000, where 10000 = 100%). A value of 0 means no floor (unlimited redemptions as long as reserves last).

### Optional: Members-only mode

The Space can restrict redemptions to Space members only (requires membership in the Space to redeem). By default, any token holder can redeem.

---

## Example: Full Lifecycle

1. **Space "GreenDAO" creates a community token** called GREEN via the normal token factory

2. **GreenDAO passes a single proposal**: _"Back GREEN with USDC at 1 USDC/token (deposit $10,000) and HYPHA at 2 HYPHA/token (deposit 5,000 HYPHA), minimum 20% backing"_

   - Backing Vault is auto-created with 20% minimum backing
   - USDC added at rate 1:1, 10,000 USDC deposited
   - HYPHA added at rate 2:1, 5,000 HYPHA deposited
   - All in one transaction

3. **Reserve now holds**: 10,000 USDC + 5,000 HYPHA

4. **Alice holds 50 GREEN tokens** and wants to cash out

   - She redeems 50 GREEN for USDC → receives 50 USDC
   - Reserve now: 9,950 USDC + 5,000 HYPHA

5. **Bob holds 100 GREEN tokens** and wants a mix

   - He redeems 100 GREEN: 70% USDC + 30% HYPHA
   - Gets: 70 USDC + 60 HYPHA
   - Reserve now: 9,880 USDC + 4,940 HYPHA

6. **Reserve gets low** — the 20% minimum kicks in

   - The combined coverage across USDC + HYPHA (converted to space-token-equivalents) approaches 20% of remaining supply
   - Once aggregate coverage would drop below 20%, ALL redemptions are blocked — regardless of which backing token is chosen
   - GreenDAO can pass a proposal to deposit more of any backing token to restore coverage and re-enable redemptions

7. **GreenDAO gets another grant** and tops up the reserve
   - The cycle continues...
