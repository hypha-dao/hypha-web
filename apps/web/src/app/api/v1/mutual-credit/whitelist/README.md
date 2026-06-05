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

Body:

```json
{
  "accounts": ["0x1234567890123456789012345678901234567890"],
  "allowed": [true]
}
```

Use `true` to whitelist an address for Mutual Credit, or `false` to remove it.

Example:

```bash
curl -X POST "https://your-domain.com/api/v1/mutual-credit/whitelist" \
  -H "Authorization: Bearer <MUTUAL_CREDIT_WHITELIST_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"accounts":["0x1234567890123456789012345678901234567890"],"allowed":[true]}'
```

Required Vercel env vars:

```txt
MUTUAL_CREDIT_WHITELIST_API_KEY=<shared API key>
MUTUAL_CREDIT_WHITELIST_SIGNER_PRIVATE_KEY=<server-only wallet private key>
RPC_URL=<Base RPC URL>
```

The signer wallet must be the token contract owner or executor.
