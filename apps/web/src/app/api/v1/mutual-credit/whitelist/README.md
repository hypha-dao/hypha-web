# Mutual Credit Whitelist API

Grant or revoke **address-level mutual credit eligibility** on a Hypha regular
space token (Base). Use this when a user logs in (or links a wallet) so they can
spend up to that token’s `defaultCreditLimit` even with a zero ERC-20 balance.

**Base URL (production):** `https://app.hypha.earth`  
**Network:** Base mainnet (`8453`)  
**Auth:** shared API key (issued by Hypha)

---

## Endpoint

```http
POST /api/v1/mutual-credit/whitelist
```

### Headers

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <API_KEY>` |
| `Content-Type` | `application/json` |

`x-api-key: <API_KEY>` is also accepted instead of the Bearer header.

### Body

```json
{
  "tokenAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
  "accounts": ["0x1234567890123456789012345678901234567890"],
  "allowed": [true]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `tokenAddress` | **yes** | Token contract on Base to update (checksummed or lowercase) |
| `accounts` | **yes** | Wallet addresses to grant/revoke (1–100, no duplicates) |
| `allowed` | **yes** | Parallel booleans: `true` = whitelist, `false` = remove. Must match `accounts.length` |

### Success (`200`)

```json
{
  "transactionHash": "0x…",
  "contractAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
  "accountCount": 1
}
```

- `contractAddress` is always the `tokenAddress` you sent — use it to confirm the right token was updated.
- Wait for the tx to confirm on Base before treating the user as whitelisted.

### Errors

| Status | When |
| --- | --- |
| `401` | Missing/invalid API key |
| `400` | Invalid JSON, validation failure, non-contract `tokenAddress`, or Hypha signer not authorized on that token |
| `500` | Unexpected failure (RPC, simulation, broadcast) |

Validation failures include a `details` object (Zod flatten). Other `400`/`500` bodies look like `{ "error": "…" }`.

---

## Examples

### Whitelist a user on QUAIL (West Marin)

```bash
curl -X POST "https://app.hypha.earth/api/v1/mutual-credit/whitelist" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
    "accounts": ["0xUSER_WALLET"],
    "allowed": [true]
  }'
```

### Whitelist a user on La Clarine

```bash
curl -X POST "https://app.hypha.earth/api/v1/mutual-credit/whitelist" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0x0692C428864A3e2775C4d4Db3a84124435C7913D",
    "accounts": ["0xUSER_WALLET"],
    "allowed": [true]
  }'
```

### Batch (grant + revoke)

```json
{
  "tokenAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
  "accounts": ["0xAAA…", "0xBBB…"],
  "allowed": [true, false]
}
```

### Suggested integration (login)

1. User authenticates / links a Base wallet.
2. Resolve which mutual-credit token(s) they need (e.g. QUAIL for a West Marin listing).
3. `POST` whitelist with that `tokenAddress` and `accounts: [wallet]`, `allowed: [true]`.
4. Optionally poll BaseScan / wait for receipt, then verify on-chain (below).
5. Only then let them pay with mutual credit.

You must pass **`tokenAddress` for every call**. There is no default token.

---

## Verify on-chain

After a successful response (and tx confirmation), check the **same** token:

```bash
# true if address-whitelisted
cast call <TOKEN> \
  "isCreditWhitelistedAddress(address)(bool)" \
  <USER> \
  --rpc-url https://mainnet.base.org

# effective credit limit (wei, 18 decimals). > 0 means they can use credit
cast call <TOKEN> \
  "creditLimitOf(address)(uint256)" \
  <USER> \
  --rpc-url https://mainnet.base.org
```

Known tokens:

| Token | Address | Notes |
| --- | --- | --- |
| QUAIL (The Quail) | `0x2919285decFD2CE657445E8b22928aB84edE6D90` | `defaultCreditLimit` = 48 QUAIL |
| CLARINE (La Clarine) | `0x0692C428864A3e2775C4d4Db3a84124435C7913D` | Previous hardcoded API target |

---

## How mutual credit works (short)

- Eligibility is **per token**, not global.
- An eligible wallet can spend up to `defaultCreditLimit` when their ERC-20 balance is insufficient; the shortfall is **minted as debt** (`creditBalanceOf`).
- Receiving tokens later **auto-repays** debt (burn).
- Credit mints still respect `maxSupply`. If `totalSupply == maxSupply`, spends that need new minting fail with `supply exceeded` even for whitelisted users.
- Amounts use **18 decimals** (e.g. 10 QUAIL = `10000000000000000000`).

Whitelisting via this API is one path to eligibility. Members of a token’s **credit-whitelisted spaces** also get `defaultCreditLimit` without an address whitelist entry.

---

## Breaking change (for existing callers)

Earlier versions always updated La Clarine and ignored other tokens.  
`tokenAddress` is now **required**. Clarine callers must send:

`0x0692C428864A3e2775C4d4Db3a84124435C7913D`

For QUAIL payments, send the QUAIL address above — otherwise login whitelisting will not affect QUAIL spends (`!credit`).

---

## Hypha ops (not needed by API clients)

Server env (Vercel):

```txt
MUTUAL_CREDIT_WHITELIST_API_KEY=<shared API key>
MUTUAL_CREDIT_WHITELIST_SIGNER_PRIVATE_KEY=<server-only wallet>
RPC_URL=<Base RPC URL>
```

The signer must be **owner**, **executor**, or **authorized minter** on each
`tokenAddress`. That is configured on Hypha’s side (platform owner key, or an
Update Issued Token proposal granting the signer as authorized minter).
