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

**It's one-way only.** Members send community tokens IN (which are **burned permanently**) and get backing tokens OUT. They don't buy community tokens through the vault — those come from the Space's normal token distribution (minting, proposals, payments, etc.).

---

## How It Gets Set Up

### Step 1: Space passes a proposal to add a backing token

This is **the only step needed**. One proposal, one transaction:

> _"Back our token with USDC at a rate of 2 USDC per token"_

Behind the scenes, this single call creates the vault automatically and adds USDC as a backing option.

### Step 2: Fund the reserve

Someone (the Space, a funder, a grant, anyone) deposits the actual backing tokens into the reserve:

> _"Deposit 50,000 USDC into the vault reserve"_

### Step 3: Members can redeem

Any token holder can now send their community tokens to the vault and receive USDC (or whichever backing token they choose).

### Optional: Add more backing tokens

The Space can pass additional proposals to add other assets:

> _"Also back our token with HYPHA at 0.5 HYPHA per token"_ > _"Also back our token with WETH at 0.001 WETH per token"_

Now members have **a choice** when redeeming — they pick which asset they want.

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

| Action                                  | Who                                                           |
| --------------------------------------- | ------------------------------------------------------------- |
| Add a backing token + set exchange rate | Space (via proposal through the executor)                     |
| Remove a backing token                  | Space (via proposal)                                          |
| Change the exchange rate                | Space (via proposal)                                          |
| Fund the reserve with backing tokens    | **Anyone** (donors, grants, the Space itself)                 |
| Redeem community tokens for backing     | **Any token holder** (optionally restricted to Space members) |
| Withdraw reserves                       | Space (via proposal)                                          |
| Pause/unpause redemptions               | Space (via proposal)                                          |

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

### Optional: Members-only mode

The Space can restrict redemptions to Space members only (requires membership in the Space to redeem). By default, any token holder can redeem.

---

## Example: Full Lifecycle

1. **Space "GreenDAO" creates a community token** called GREEN via the normal token factory

2. **GreenDAO passes a proposal**: _"Add USDC backing at 1 USDC per GREEN token"_

   - Backing Vault is auto-created
   - USDC is added as a backing option at rate 1:1

3. **GreenDAO receives a $10,000 grant** and deposits it into the vault reserve

   - Reserve now holds 10,000 USDC

4. **GreenDAO passes another proposal**: _"Also add HYPHA backing at 2 HYPHA per GREEN token"_

   - HYPHA is now a second redemption option

5. **A HYPHA holder donates 5,000 HYPHA** to the GreenDAO vault

   - Reserve now holds: 10,000 USDC + 5,000 HYPHA

6. **Alice holds 50 GREEN tokens** and wants to cash out

   - She redeems 50 GREEN for USDC → receives 50 USDC
   - Reserve now: 9,950 USDC + 5,000 HYPHA

7. **Bob holds 100 GREEN tokens** and wants a mix

   - He redeems 100 GREEN: 70% USDC + 30% HYPHA
   - Gets: 70 USDC + 60 HYPHA
   - Reserve now: 9,880 USDC + 4,940 HYPHA

8. **GreenDAO gets another grant** and tops up the reserve
   - The cycle continues...
