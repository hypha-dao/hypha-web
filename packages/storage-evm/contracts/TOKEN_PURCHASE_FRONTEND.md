# Token Purchase (Frontend Quick Guide)

This doc explains how to integrate token purchases for `RegularSpaceToken`.

## Core flow

1. Read sale config from `getTokenSaleDetails()`.
2. User enters token amount to buy.
3. Compute payment amount on frontend:
   - `paymentAmount = tokenAmount * salePricePerToken / 1e18`
4. Ensure buyer has enough payment token balance.
5. Ensure allowance is enough; if not, ask for approval.
6. Call `buyTokens(tokenAmount)`.

## Important read calls

- `getTokenSaleDetails()` -> `(salePaymentToken, salePricePerToken, tokensLeftToSell)`
- `tokensSold()` and `tokensForSale()` if you need raw values
- `purchaseEligibilityMode()` -> `0` (issuer space only), `1` (custom spaces), `2` (all spaces)
- `canAccountPurchase(account)` -> whether account can currently buy
- `getPurchaseWhitelistedSpaces()` -> custom purchase spaces (used in mode `1`)

## Deploy-time purchase params

When creating tokens via factory (`deployToken`, `deployDecayingToken`, `deployOwnershipToken`), pass these purchase-related params explicitly:

- `paymentToken` (`address`)
  - ERC20 token users pay with (USDC, USDT, etc.).
  - Use `address(0)` to start with sale disabled.
  - Source: selected payment token from your UI config / token list.
- `paymentTokenPricePerToken` (`uint256`)
  - Price in `paymentToken` smallest units per `1e18` token amount.
  - Example: if token has 18 decimals and price is `2.5 USDC`, pass `2_500_000` (USDC has 6 decimals).
  - Source: admin-entered sale price in UI, converted to payment token decimals.
- `tokensForSale` (`uint256`)
  - Max token amount sellable in this sale (18-decimal token units).
  - Source: admin-entered cap in UI, converted with `parseEther`-style scaling.
- `purchaseEligibilityMode` (`uint8`)
  - `0` = issuer space only
  - `1` = custom spaces
  - `2` = all spaces
  - Source: admin selection in UI (default should be `0` in frontend).
- `initialPurchaseWhitelistSpaceIds` (`uint256[]`)
  - Required only when mode is `1`; ignored in other modes.
  - Source: selected space IDs from your space picker / DAO data.

Where to get values in practice:

- `paymentToken` and token decimals: from your supported payment-token registry.
- `spaceId` / whitelist space IDs: from DAOSpace data your app already uses for memberships.
- price/cap/mode: from token-creation form fields.

## Who can buy

Anyone can call `buyTokens` (individual or space-controlled wallet), but access is controlled by purchase mode:

- `0` issuer-space-only (default): buyer must be member of the token's issuing space
- `1` custom spaces: buyer must be member of one of `getPurchaseWhitelistedSpaces()`
- `2` all spaces: buyer must be a member of any space

The contract only cares about `msg.sender` having:

- enough payment token balance
- enough allowance
- purchase eligibility per mode above

## Purchase whitelist admin (executor only)

- `setPurchaseEligibilityMode(mode)`
- `batchAddPurchaseWhitelistSpaces(spaceIds)`
- `batchRemovePurchaseWhitelistSpaces(spaceIds)`

These can be configured at token creation and changed later.

## Best UX for approvals

Use a two-step, one-screen purchase UX:

- Step 1: `Approve` (only when allowance < required amount)
- Step 2: `Buy`

Recommended details:

- Pre-check allowance; hide/disable `Approve` if already sufficient.
- Approve exact amount by default.
- Optional "approve max" toggle for power users.
- After approval tx confirms, auto-enable `Buy`.
- Show clear pending states for both transactions.

## Common errors to map to user-friendly messages

- `Token sale is not configured` -> "Sale is not active."
- `Token sale price not set` -> "Sale price is missing."
- `Token sale is disabled` -> "Sale is currently disabled."
- `Not enough tokens left` -> "Not enough tokens remaining in this sale."
- `Buyer not eligible to purchase` -> "This wallet is not eligible to buy this token."
- ERC20 allowance/transfer failure -> "Approval or payment token transfer failed."

## Treasury behavior

On successful buy, payment token is sent directly to the issuing space treasury (`executor`), and purchased tokens are minted to the buyer.
