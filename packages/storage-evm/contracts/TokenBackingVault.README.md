# Token Backing Vault — How It Works

## What Is It?

The Token Backing Vault lets a Space **back its community token with real assets** so members can redeem their tokens for backing assets at any time.

The vault reads the token's **price and currency** directly from the token contract — no duplicate configuration needed. If the Space sets their token to "2 EUR" via `setPriceWithCurrency`, the vault automatically knows each token is worth 2 EUR.

---

## The Core Idea

```
  1 COMMUNITY_TOKEN = whatever the token's price says
  (e.g., $2 USD, €1 EUR, ¥150 JPY — set on the token contract)
                        │
                        ▼
        ┌───────────────────────────────┐
        │      Token Backing Vault      │
        │                               │
        │   Token says: 1 GREEN = $2    │
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
  Member redeems 100 GREEN (= $200)
  Picks WETH → $200 / $2,500 = 0.08 WETH
  Picks HYPHA → $200 / $0.50 = 400 HYPHA
```

**It's one-way only.** Members send community tokens IN (which are **burned permanently**) and get backing tokens OUT.

---

## Two Types of Backing Tokens

### Oracle-priced tokens (external assets)

**USDC, EURC, WETH, WBTC** — prices come from Chainlink price feeds. The contract reads live prices at redemption time.

### Hypha tokens (community tokens)

**Any token created in Hypha** can also be used as backing. Their price is read from the token contract's `priceInUSD` field (+ `priceCurrencyFeed` for non-USD currencies). The vault converts through USD automatically.

---

## How Pricing Works

**Everything flows through USD as the common denominator.**

```
┌─────────────────────────────────────────────────┐
│                 PRICE CHAIN                      │
│                                                  │
│  Space token (GREEN):                            │
│    token.priceInUSD()        → 2,000,000 (2.00)  │
│    token.priceCurrencyFeed() → EUR/USD feed      │
│    → 2 EUR × $1.08/EUR = $2.16 USD per GREEN    │
│                                                  │
│  Oracle backing token (WETH):                    │
│    Chainlink ETH/USD → $2,500 per ETH            │
│                                                  │
│  Hypha backing token (HYPHA_EARTH):              │
│    token.priceInUSD()        → 1,000,000 (1.00)  │
│    token.priceCurrencyFeed() → CAD/USD feed      │
│    → 1 CAD × $0.73/CAD = $0.73 USD per HYPHA    │
│                                                  │
│  Redemption: 100 GREEN = $216 USD                │
│    → WETH: $216 / $2,500 = 0.0864 WETH          │
│    → HYPHA: $216 / $0.73 = 295.89 HYPHA         │
└─────────────────────────────────────────────────┘
```

---

## How It Gets Set Up

### Step 1: Set the token's price (on the token contract)

Before creating a vault, the Space sets the token's price via `setPriceWithCurrency`:

```
setPriceWithCurrency(2_000_000, eurUsdFeedAddress)
→ "This token is worth 2 EUR"
```

Or for USD: `setPriceInUSD(2_000_000)` → "This token is worth $2 USD"

### Step 2: Create the vault (one proposal)

```
addBackingToken(
  spaceId, spaceToken,
  [usdc, weth, hyphaToken],           // backing tokens
  [usdcFeed, ethFeed, address(0)],    // Chainlink feeds (0 = Hypha token)
  [6, 18, 18],                        // token decimals
  [50_000e6, 10e18, 5_000e18],        // funding (0 = skip)
  2000                                // 20% minimum backing
)
```

That's it. The vault reads the peg value and currency from the token contract automatically.

### After setup

- **Change the peg?** → Update `setPriceWithCurrency` on the token contract. The vault reads it live.
- **Add more reserves?** → `addBacking` (requires a proposal)
- **Add more backing tokens?** → Call `addBackingToken` again

---

## Who Can Do What

| Action                           | Who                                                               |
| -------------------------------- | ----------------------------------------------------------------- |
| Set token price / currency       | Token's Space (via `setPriceWithCurrency` on the token contract)  |
| Add backing tokens + price feeds | Space (via proposal)                                              |
| Remove a backing token           | Space (via proposal)                                              |
| Update a Chainlink price feed    | Space (via proposal)                                              |
| Change minimum backing threshold | Space (via proposal)                                              |
| Set redemption start date        | Space (via proposal)                                              |
| Manage whitelist                 | Space (via proposal)                                              |
| Fund the reserve                 | Space (via proposal)                                              |
| Redeem community tokens          | Whitelisted / members / any holder (depending on configuration)   |
| Withdraw reserves                | Space (via proposal)                                              |
| Pause/unpause redemptions        | Space (via proposal)                                              |

---

## Important Details

### Price and currency come from the token

The vault does NOT store the peg value or fiat currency. It reads `priceInUSD()` and `priceCurrencyFeed()` from the community token contract at redemption time. This means:
- Updating the token's price automatically changes what redeemers receive
- No separate vault update needed when the peg changes
- The token's Space controls the price; the vault just reads it

### All prices flow through USD

Whether a token's price is in EUR, CAD, or JPY, the vault converts it to USD using the token's `priceCurrencyFeed` (a Chainlink X/USD feed). Backing token prices are also in USD (from Chainlink or from `priceInUSD` on Hypha tokens). USD is the common denominator — no direct cross-currency math needed.

### Whitelist + membership (OR logic)

- **Whitelist**: when enabled, whitelisted addresses can redeem
- **Members-only**: when enabled, Space members can redeem
- If both are active, satisfying **either** one is enough
- If neither is active, anyone can redeem

### Redemption start date

The Space can set a future date from which redemptions are allowed. Before that date, all redemptions are blocked.

### Minimum backing threshold

The contract computes **aggregate USD coverage** across ALL backing tokens. If a redemption would push total coverage below the minimum percentage of the remaining USD liability (supply × token price in USD), it's blocked.

### What happens to redeemed community tokens?

Redeemed tokens are **burned permanently**, reducing total supply.

---

## Example: Full Lifecycle

1. **Space "GreenDAO" creates GREEN token** and sets price to $2 USD via `setPriceInUSD(2_000_000)`

2. **GreenDAO passes a proposal** to create a backing vault with USDC, WETH, and HYPHA_EARTH:
   - USDC + WETH use Chainlink feeds
   - HYPHA_EARTH is a Hypha token (price from its contract: $0.50)
   - 20% minimum backing, whitelist required, start date April 1st

3. **GreenDAO whitelists contributors** — 100 addresses added

4. **April 1st** — redemptions open

5. **Alice redeems 100 GREEN for USDC**: 100 × $2 = $200 → 200 USDC

6. **Bob redeems 200 GREEN for WETH**: 200 × $2 = $400; ETH at $2,500 → 0.16 WETH

7. **Carol redeems 100 GREEN for HYPHA_EARTH**: 100 × $2 = $200; HYPHA at $0.50 → 400 HYPHA_EARTH

8. **GreenDAO updates token price to $3** via `setPriceInUSD(3_000_000)` — next redemptions automatically use $3

9. **Reserve coverage drops near 20%** → redemptions blocked until more backing is deposited
