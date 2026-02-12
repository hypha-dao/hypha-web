# Token Backing Vault — How It Works

## What Is It?

The Token Backing Vault lets a Space **back its community token with real assets** and define a **fiat-referenced redemption value**. Token holders can redeem their community tokens for the backing assets at a price determined by Chainlink oracles (for external assets) or the token's own on-chain price (for Hypha tokens).

Think of it like: _"Each of our tokens is worth 2 USD of real assets, and members can cash out at any time."_

---

## The Core Idea

```
  1 COMMUNITY_TOKEN = pegValue of fiat currency
  (e.g., 1 token = 2 USD, or 1 token = 150 JPY)
                        │
                        ▼
        ┌───────────────────────────────┐
        │      Token Backing Vault      │
        │                               │
        │   Peg: 1 token = $2 USD       │
        │                               │
        │   Reserves:                   │
        │     50,000 USDC  (oracle)     │
        │     20 WETH      (oracle)     │
        │     5,000 HYPHA  (on-chain)   │
        │                               │
        │   Prices:                     │
        │     USDC  = $1.00  (Chainlink)│
        │     WETH  = $2,500 (Chainlink)│
        │     HYPHA = $0.50  (on-chain) │
        └───────────────────────────────┘
                        │
                        ▼
  Member redeems 100 tokens (= $200 value)
  Picks WETH → 200 / 2500 = 0.08 WETH
  Picks HYPHA → 200 / 0.50 = 400 HYPHA
```

**It's one-way only.** Members send community tokens IN (which are **burned permanently**) and get backing tokens OUT.

---

## Two Types of Backing Tokens

### Oracle-priced tokens (external assets)

**USDC, EURC, WETH, WBTC** — prices come from [Chainlink price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses/?network=base) on Base. The contract reads live prices at redemption time.

When adding these tokens, provide the Chainlink price feed address.

### Hypha tokens (community tokens)

**Any token created in Hypha** (RegularSpaceToken, etc.) can also be used as backing. Their price is read from the token contract's `price` field (set by the token's space via proposal).

When adding Hypha tokens, pass `address(0)` as the price feed — the contract reads the price directly from the token.

---

## How It Gets Set Up

### One call does it all

```
addBackingToken(
  spaceId, spaceToken,
  [usdc, weth, hyphaToken],           // backing tokens
  [usdcFeed, ethFeed, address(0)],    // Chainlink feeds (0 = Hypha token)
  [6, 18, 18],                        // token decimals
  [50_000e6, 10e18, 5_000e18],        // funding (0 = skip)
  address(0),                         // fiat peg (0 = USD)
  2_000_000,                          // 1 token = 2 USD (6 decimals)
  2000                                // 20% minimum backing
)
```

**Peg value** (6 decimals): defines how much fiat currency 1 community token is worth.
- `1_000_000` → 1 token = 1 fiat unit
- `2_000_000` → 1 token = 2 fiat units
- `500_000` → 1 token = 0.5 fiat units
- `150_000_000` → 1 token = 150 fiat units (e.g., 150 JPY)

**Fiat peg selection:**
- `address(0)` → USD
- Chainlink EUR/USD feed → EUR
- Chainlink JPY/USD feed → JPY
- Any fiat with a Chainlink/USD feed

### After setup: Configure access

The Space can optionally:

- **Set a whitelist** — only approved addresses can redeem
- **Enable members-only** — only Space members can redeem
- If both are active, either one is sufficient (OR logic)
- **Set a redemption start date** — redemptions locked until a specific date

### Top up reserves later

The Space can deposit more backing tokens via `addBacking` (requires a proposal).

---

## Redemption Options

### Option A: Pick one token

_"I want to redeem 100 tokens for USDC"_ (vault pegged at $2/token)

→ Fiat value = 100 × $2 = $200
→ Oracle: USDC = $1.00
→ Member receives 200 USDC

_"I want to redeem 100 tokens for WETH"_

→ Fiat value = $200
→ Oracle: WETH = $2,500
→ Member receives 0.08 WETH

_"I want to redeem 100 tokens for HYPHA"_

→ Fiat value = $200
→ On-chain price: HYPHA = $0.50
→ Member receives 400 HYPHA

### Option B: Split across multiple tokens

_"Redeem 1000 tokens — 50% USDC, 30% WETH, 20% HYPHA"_

→ Total fiat value = 1000 × $2 = $2,000
→ 500 tokens ($1,000) → 1,000 USDC
→ 300 tokens ($600) → 0.24 WETH
→ 200 tokens ($400) → 800 HYPHA

---

## Who Can Do What

| Action                           | Who                                                               |
| -------------------------------- | ----------------------------------------------------------------- |
| Add backing tokens + price feeds | Space (via proposal)                                              |
| Remove a backing token           | Space (via proposal)                                              |
| Update a price feed              | Space (via proposal)                                              |
| Change peg value                 | Space (via proposal)                                              |
| Change minimum backing threshold | Space (via proposal)                                              |
| Set redemption start date        | Space (via proposal)                                              |
| Manage whitelist                 | Space (via proposal)                                              |
| Fund the reserve                 | Space (via proposal)                                              |
| Redeem community tokens          | Whitelisted / members / any holder (depending on configuration)   |
| Withdraw reserves                | Space (via proposal)                                              |
| Pause/unpause redemptions        | Space (via proposal)                                              |

---

## Important Details

### Oracle pricing for external assets

USDC, EURC, WETH, and WBTC use [Chainlink price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses/?network=base). The contract reads live prices at redemption time and rejects stale data (>24h old).

For non-USD pegs, a fiat/USD Chainlink feed converts the price to the target fiat currency.

### On-chain pricing for Hypha tokens

Any Hypha community token (RegularSpaceToken, etc.) can be used as backing. The price is read from the token contract's `price` field (6 decimals). This price is assumed to be in the vault's fiat currency — the token admin is responsible for keeping it accurate.

### Configurable peg

The Space defines how much fiat currency each community token is worth. This can be changed later via `setPegValue`. The peg value uses 6 decimal precision.

### Whitelist + membership (OR logic)

- **Whitelist**: when enabled, whitelisted addresses can redeem
- **Members-only**: when enabled, Space members can redeem
- If both are active, satisfying **either** one is enough
- If neither is active, anyone can redeem

### Redemption start date

The Space can set a future date from which redemptions are allowed. Before that date, all redemptions are blocked.

### Minimum backing threshold

The contract computes **aggregate fiat coverage** across ALL backing tokens (using oracle prices for external assets and on-chain prices for Hypha tokens). If a redemption would push total coverage below the minimum percentage of the remaining fiat liability (supply × pegValue), it's blocked.

### What happens to redeemed community tokens?

Redeemed tokens are **burned permanently**, reducing total supply.

---

## Example: Full Lifecycle

1. **Space "GreenDAO" creates a community token** called GREEN

2. **GreenDAO passes a proposal**: _"Back GREEN at $2/token with USDC, WETH, and HYPHA_EARTH (another Hypha token at $0.50), 20% minimum backing, whitelist required, redemptions start April 1st"_

   - Token Backing Vault auto-created
   - pegValue = 2_000_000 ($2 per GREEN)
   - USDC added (Chainlink feed), funded with 50,000 USDC
   - WETH added (Chainlink feed), funded with 10 WETH
   - HYPHA_EARTH added (on-chain price), funded with 20,000 tokens
   - 20% minimum backing, whitelist enabled, start date April 1st

3. **GreenDAO whitelists contributors** — 100 addresses added

4. **April 1st** — redemptions open

5. **Alice redeems 500 GREEN for USDC**
   - Fiat value = 500 × $2 = $1,000
   - USDC at $1.00 → receives 1,000 USDC

6. **Bob redeems 200 GREEN for WETH**
   - Fiat value = 200 × $2 = $400
   - ETH at $2,500 → receives 0.16 WETH

7. **Carol redeems 100 GREEN for HYPHA_EARTH**
   - Fiat value = 100 × $2 = $200
   - HYPHA_EARTH at $0.50 (on-chain) → receives 400 HYPHA_EARTH

8. **ETH price rises to $3,000** — redemption amount adjusts automatically
   - Next user redeeming for WETH gets less WETH per token (same fiat value, higher ETH price)

9. **Aggregate reserve coverage approaches 20%** → redemptions blocked until topped up

