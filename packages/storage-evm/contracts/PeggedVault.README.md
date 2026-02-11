# Pegged Vault — How It Works

## What Is It?

The Pegged Vault lets a Space **peg its community token 1:1 to a fiat currency** (USD, EUR, JPY, GBP, etc.). Token holders can then **redeem their community tokens for real assets** at the current market rate using Chainlink price oracles.

Think of it like a stablecoin reserve: _"1 of our token is always worth 1 USD (or 1 EUR, 1 JPY…) of real assets."_

---

## The Core Idea

```
  1 COMMUNITY_TOKEN = 1 USD (or 1 EUR, 1 JPY, etc.)
                        │
                        ▼
        ┌───────────────────────────────┐
        │         Pegged Vault          │
        │                               │
        │   Peg: USD                    │
        │                               │
        │   Reserves:                   │
        │     50,000 USDC               │
        │     20 WETH                   │
        │     1.5 WBTC                  │
        │                               │
        │   Prices (live from oracle):  │
        │     USDC  = $1.00             │
        │     WETH  = $2,500            │
        │     WBTC  = $60,000           │
        └───────────────────────────────┘
                        │
                        ▼
  Member redeems 100 tokens, picks WETH
  → 100 USD / $2,500 per ETH = 0.04 WETH
```

**It's one-way only.** Members send community tokens IN (which are **burned permanently**) and get backing tokens OUT at the oracle rate.

---

## How It Gets Set Up

### One call does it all

A single proposal can create the vault, add backing tokens with their Chainlink feeds, fund the reserves, and set a minimum backing floor:

```
addBackingToken(
  spaceId, spaceToken,
  [usdc, weth, wbtc],                         // backing tokens
  [usdcUsdFeed, ethUsdFeed, btcUsdFeed],       // Chainlink price feeds
  [6, 18, 8],                                  // token decimals
  [50_000e6, 20e18, 1.5e8],                    // funding amounts (0 = skip)
  address(0),                                  // fiat peg (0 = USD, or EUR/USD feed)
  2000                                         // 20% minimum backing
)
```

**Fiat peg selection:**

- `address(0)` → USD peg (1 token = 1 USD)
- Pass a Chainlink EUR/USD feed → EUR peg (1 token = 1 EUR)
- Pass a Chainlink JPY/USD feed → JPY peg (1 token = 1 JPY)
- Works with any fiat currency that has a Chainlink/USD price feed

**Supported fiat currencies** (any with a Chainlink feed):
USD, EUR, GBP, JPY, CAD, CHF, CNY, AUD, HKD, and more.

### After setup: Configure access

The Space can optionally:

- **Set a whitelist** — only approved addresses can redeem (via `addToWhitelist`)
- **Enable members-only** — only Space members can redeem
- **Set a redemption start date** — redemptions locked until a specific date

### Top up the reserve later

The Space can deposit more backing tokens via `addBacking` (requires a proposal through the executor).

---

## Redemption Options

### Option A: Pick one token

_"I want to redeem 500 tokens for USDC"_ (USD-pegged vault)

→ Oracle says USDC = $1.00
→ Member sends 500 tokens, receives 500 USDC

_"I want to redeem 500 tokens for WETH"_ (USD-pegged vault)

→ Oracle says ETH = $2,500
→ Member sends 500 tokens, receives 0.2 WETH

### Option B: Split across multiple tokens

_"I want to redeem 1000 tokens — 60% USDC, 40% WETH"_

→ 600 tokens → 600 USDC
→ 400 tokens → 400/2500 = 0.16 WETH

---

## Who Can Do What

| Action                           | Who                                                                   |
| -------------------------------- | --------------------------------------------------------------------- |
| Add backing tokens + price feeds | Space (via proposal)                                                  |
| Remove a backing token           | Space (via proposal)                                                  |
| Update a price feed              | Space (via proposal)                                                  |
| Change minimum backing threshold | Space (via proposal)                                                  |
| Set redemption start date        | Space (via proposal)                                                  |
| Manage whitelist                 | Space (via proposal)                                                  |
| Fund the reserve                 | Space (via proposal)                                                  |
| Redeem community tokens          | Whitelisted / members / any holder (depending on vault configuration) |
| Withdraw reserves                | Space (via proposal)                                                  |
| Pause/unpause redemptions        | Space (via proposal)                                                  |

---

## Important Details

### Oracle-based pricing

Prices come from [Chainlink price feeds](https://docs.chain.link/data-feeds/price-feeds/addresses/?network=base) on Base. The contract reads `latestRoundData()` at redemption time and rejects stale prices (>24h old).

Each backing token has its own Chainlink feed (e.g., ETH/USD, BTC/USD, USDC/USD). For non-USD pegs, a separate fiat/USD feed converts the price to the target fiat currency.

### Max 4 backing tokens

Each vault supports up to 4 backing tokens: **USDC, EURC, WETH, WBTC**. These are the only assets that can back the pegged token.

### Whitelist + membership

Two access controls, both optional, combined with **OR** logic:

- **Whitelist**: when enabled, whitelisted addresses can redeem. Managed via `addToWhitelist` / `removeFromWhitelist` proposals.
- **Members-only**: when enabled, Space members can redeem.
- If both are active, the redeemer needs to satisfy **either** one — being whitelisted OR being a member is enough.
- If neither is active, anyone can redeem.

### Redemption start date

The Space can set a future date from which redemptions become possible. Before that date, all redemptions are blocked. Set via `setRedemptionStartDate`.

### Minimum backing threshold

Works the same as the Backing Vault — the contract computes **aggregate coverage** across all backing tokens (using oracle prices) and blocks redemptions that would push total coverage below the minimum percentage of remaining supply.

### What happens to redeemed community tokens?

Same as the Backing Vault — redeemed tokens are **burned permanently**, reducing total supply and increasing the backing ratio for remaining holders.

---

## Example: Full Lifecycle

1. **Space "StableDAO" creates a community token** called STABLE pegged to USD

2. **StableDAO passes a single proposal**: _"Back STABLE with USDC + WETH + WBTC, fund reserves, set 25% minimum backing, whitelist required, redemptions start March 1st"_

   - Pegged Vault auto-created (USD peg)
   - USDC, WETH, WBTC added with Chainlink feeds
   - Reserves funded: 100k USDC + 20 WETH + 2 WBTC
   - 25% minimum backing set
   - Whitelist enabled
   - Redemption start date: March 1st

3. **StableDAO whitelists early contributors** via another proposal

   - 50 addresses added to the whitelist

4. **March 1st arrives** — redemptions open

5. **Alice is whitelisted** and holds 1,000 STABLE

   - She redeems 1,000 STABLE for USDC → receives 1,000 USDC (1:1 at oracle rate)

6. **Bob is whitelisted** and holds 5,000 STABLE

   - ETH is at $2,500 — he redeems 5,000 STABLE for WETH → receives 2 WETH

7. **ETH price changes to $3,000**

   - Carol redeems 3,000 STABLE for WETH → receives 1 WETH (3000/3000)
   - The oracle rate adjusts automatically — no proposal needed

8. **Reserve coverage gets low** — the 25% minimum kicks in

   - Aggregate coverage across USDC + WETH + WBTC (at current oracle prices) drops near 25%
   - Further redemptions are blocked until StableDAO tops up reserves
