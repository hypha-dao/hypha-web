# Mutual Credit Whitelist API

Endpoint:

```txt
POST /api/v1/mutual-credit/whitelist
```

Headers:

```txt
Authorization: Bearer <MUTUAL_CREDIT_WHITELIST_API_KEY>
Content-Type: application/json
```

`x-api-key: <MUTUAL_CREDIT_WHITELIST_API_KEY>` is also accepted.

Body:

```json
{
  "tokenAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
  "accounts": ["0x1234567890123456789012345678901234567890"],
  "allowed": [true]
}
```

| Field          | Required | Description                                                      |
| -------------- | -------- | ---------------------------------------------------------------- |
| `tokenAddress` | yes      | Regular space token contract on Base (e.g. QUAIL, CLARINE)       |
| `accounts`     | yes      | Addresses to grant or revoke mutual-credit eligibility (max 100) |
| `allowed`      | yes      | Parallel flags: `true` whitelist, `false` remove                 |

Example (QUAIL):

```bash
curl -X POST "https://app.hypha.earth/api/v1/mutual-credit/whitelist" \
  -H "Authorization: Bearer <MUTUAL_CREDIT_WHITELIST_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress":"0x2919285decFD2CE657445E8b22928aB84edE6D90",
    "accounts":["0x1234567890123456789012345678901234567890"],
    "allowed":[true]
  }'
```

Example (La Clarine — previously the hardcoded default):

```bash
curl -X POST "https://app.hypha.earth/api/v1/mutual-credit/whitelist" \
  -H "Authorization: Bearer <MUTUAL_CREDIT_WHITELIST_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress":"0x0692C428864A3e2775C4d4Db3a84124435C7913D",
    "accounts":["0x1234567890123456789012345678901234567890"],
    "allowed":[true]
  }'
```

Success response:

```json
{
  "transactionHash": "0x…",
  "contractAddress": "0x2919285decFD2CE657445E8b22928aB84edE6D90",
  "accountCount": 1
}
```

## Verify on-chain

After a successful response, confirm the user was added on the **same** token:

```bash
cast call <TOKEN> "isCreditWhitelistedAddress(address)(bool)" <USER> --rpc-url "$RPC_URL"
cast call <TOKEN> "creditLimitOf(address)(uint256)" <USER> --rpc-url "$RPC_URL"
```

`creditLimitOf` returns the token's `defaultCreditLimit` when the address is
whitelisted (or is a member of a credit-whitelisted space); otherwise `0`.

## Required Vercel env vars

```txt
MUTUAL_CREDIT_WHITELIST_API_KEY=<shared API key>
MUTUAL_CREDIT_WHITELIST_SIGNER_PRIVATE_KEY=<server-only wallet private key>
RPC_URL=<Base RPC URL>
```

The signer wallet must be the token contract **owner**, **executor**, or an
**authorized minter** on each `tokenAddress` you target. The route checks this
before submitting the transaction.

## Breaking change

`tokenAddress` is now required. Callers that previously relied on the hardcoded
La Clarine address must pass
`0x0692C428864A3e2775C4d4Db3a84124435C7913D` explicitly.
