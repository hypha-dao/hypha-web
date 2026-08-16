# External Signal Ingestion API

Let a community's own app produce signals that land on the Hypha **Signals Board** for their Space.

Signals written through this API go into the same `coherences` table the board reads, so they appear
in the Coherence tab (`/{lang}/dho/{spaceSlug}/coherence`) alongside signals created in Hypha — no
separate view, no sync step.

---

## How it fits together

```text
Community app
  │  POST /api/v1/spaces/{spaceSlug}/signals      (x-hypha-api-key)
  ▼
Hypha ingestion route
  ├─ verify per-space API key + scope
  ├─ credit a known Hypha person, else the space itself
  └─ insert into coherences (source = <your source slug>)
        │
        ▼
   Signals Board (existing UI)
```

Upvotes additionally mirror to the Signals contract on Base, exactly as they do for votes cast in
Hypha's own UI. That mirror is best-effort: if it fails, the vote is still recorded off-chain.

---

## Authentication

Every request carries a **per-space API key**:

```http
x-hypha-api-key: hyk_<prefix>_<secret>
```

An `Authorization: Bearer <key>` header also works, for clients that only support bearer auth.

Key properties:

| Property | Behaviour |
| --- | --- |
| Scope of validity | One space. A key presented against a different space is rejected with `403`. |
| Storage | Only a SHA-256 digest is stored. The plaintext is shown once at issuance and is unrecoverable. |
| Permissions | `signals:write` (create/update) and `signals:upvote` (record/remove upvotes), granted per key. The same ops route also issues `intelligence:read` / `intelligence:write` for [Space Intelligence](./external-intelligence-ingestion.md) — a different API (Markdown files, not board posts). Grant only the scopes the app needs. |
| Revocation | Immediate — a revoked key fails with `401`. |

> **Server-side only.** The key grants write access to the space. Never ship it to a browser, a
> mobile bundle, or any `NEXT_PUBLIC_` / `VITE_` variable. Hypha spaces can be fully public, so
> anything reachable from the client is effectively published.

### Getting a key

Keys are issued by Hypha ops, not from the space UI — precisely because a public space's UI is
readable by anyone. Ask Hypha to run:

```bash
curl -X POST https://<hypha-host>/api/v1/ops/spaces/<spaceSlug>/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "ACAW contest app",
    "source": "acaw-contest",
    "scopes": ["signals:write", "signals:upvote"]
  }'
```

Response (the only time `apiKey` is ever returned):

```json
{
  "key": {
    "id": 12,
    "spaceId": 42,
    "name": "ACAW contest app",
    "source": "acaw-contest",
    "keyPrefix": "<prefix>",
    "scopes": ["signals:write", "signals:upvote"],
    "revokedAt": null
  },
  "apiKey": "hyk_<prefix>_<secret>",
  "warning": "Store this key now — it is not recoverable. Never expose it in client-side code."
}
```

`source` is a stable slug identifying your app. It is stamped on every signal the key writes and is
what proves ownership when you later update or vote on those signals. One **active** key per `source`
per space — so rotating a key means revoking the old one and issuing a replacement under the same
`source`, which keeps ownership of everything it has already published.

List metadata (never key material) and revoke:

```bash
curl https://<hypha-host>/api/v1/ops/spaces/<spaceSlug>/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET"

curl -X DELETE https://<hypha-host>/api/v1/ops/spaces/<spaceSlug>/api-keys/12 \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET"
```

The list is paginated like every other Hypha list endpoint — `{ "data": [...], "pagination": {...} }`,
with optional `?page=` and `?pageSize=`.

For an Intelligence Business App (org memory Markdown, not the Signals board), issue
`"scopes": ["intelligence:write"]` instead (write implies read). Spec:
[external-intelligence-ingestion.md](./external-intelligence-ingestion.md).

---

## Attribution: a known member, or the space itself

The board shows who raised a signal. Your app names that person by **wallet address** or **email**:

```json
"author": { "walletAddress": "0xAbC...123" }
"author": { "email": "member@example.org" }
```

If both are supplied, the wallet is tried first.

When the author matches an existing Hypha profile, the signal is credited to that member. **When it
matches nobody — or you omit `author` entirely — the signal is still created, credited to the space
itself.** It appears on the board authored by the space, using the space's name and logo, and it
carries **no voting power**: the space stands in as a publisher, not as a member, so it holds no
tokens and cannot vote or be assigned work.

Ingestion still **never creates member profiles**. The stand-in is a single non-human record per
space, hidden from member directories and impossible to sign in as.

Every create response says which of the two happened, so you can spot a broken identity mapping:

```json
{ "attributedTo": "author" }   // matched a Hypha member
{ "attributedTo": "space" }    // published as the space
```

If you expect signals to be credited to individuals, have your members connect the same wallet or use
the same email on their Hypha profile, then re-check `attributedTo`.

---

## Create a signal

```http
POST /api/v1/spaces/{spaceSlug}/signals
```

```bash
curl -X POST https://<hypha-host>/api/v1/spaces/acme-dao/signals \
  -H "x-hypha-api-key: $HYPHA_SPACE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Riverside cleanup needs funding",
    "description": "Twelve members flagged the riverside site in this week'\''s round.",
    "type": "Opportunity",
    "priority": "high",
    "tags": ["Impact Goals", "Fundraising"],
    "externalId": "submission-42",
    "author": { "walletAddress": "0xAbC0000000000000000000000000000000000123" }
  }'
```

### Fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | 1–50 characters. The board cards are sized for short titles. |
| `description` | yes | 1–4000 characters. |
| `type` | yes | `Opportunity`, `Risk`, `Tension`, or `Insight`. |
| `priority` | no | `critical`, `high`, `medium` (default), `low`. |
| `tags` | no | Free-form strings, max 50. `External Signal` is added automatically. |
| `progressStatus` | no | A status slug configured for the space (`backlog`, `todo`, …). Defaults to the space's first status. |
| `board` | no | A board (swimlane) slug configured for the space. Defaults to the space's default board. |
| `dueAt` | no | ISO 8601 timestamp, or `null`. |
| `externalId` | no | Your own record id. Strongly recommended — see idempotency below. |
| `author` | no | `{ walletAddress }` or `{ email }`. Omit, or send an unknown one, to publish as the space. |

Unknown fields are rejected with `400`, so a typo fails loudly rather than being silently dropped.
Assignees are Hypha person ids and stay a Hypha-side concern; they cannot be set through this API.

`type` is limited to the four types Hypha's own signal editor can round-trip, which keeps every
ingested signal fully editable by space members in the UI.

### Response

`201 Created`:

```json
{
  "id": 501,
  "slug": "coh-1a2b3c4d",
  "spaceSlug": "acme-dao",
  "url": "https://<hypha-host>/en/dho/acme-dao/coherence?signal=coh-1a2b3c4d",
  "signal": { "...": "the full signal record" }
}
```

`url` deep-links to the signal on the board — good for linking your users straight into Hypha.

### Idempotency

When you send `externalId`, the pair `(space, your source, externalId)` is unique. A retry with the
same `externalId` returns **`200`** with the signal that already exists instead of creating a
duplicate. Without `externalId` every POST creates a new signal, and you also lose the ability to
update it later. Send it.

---

## Update a signal you created

```http
PATCH /api/v1/spaces/{spaceSlug}/signals/{signalSlug}
```

```bash
curl -X PATCH https://<hypha-host>/api/v1/spaces/acme-dao/signals/coh-1a2b3c4d \
  -H "x-hypha-api-key: $HYPHA_SPACE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{ "priority": "critical", "progressStatus": "in_progress" }'
```

A partial patch: omitted fields keep their stored values. `dueAt` distinguishes absent (unchanged)
from explicit `null` (cleared). `archived: true` removes the signal from the default board view.

Only signals whose `source` matches your key can be updated — signals raised by members in the
Hypha UI, or by another integration, return `403`. This is intentional: your app mirrors its own
records, it does not administer the space's board.

---

## Record and remove upvotes

```http
PUT    /api/v1/spaces/{spaceSlug}/signals/{signalSlug}/upvotes
DELETE /api/v1/spaces/{spaceSlug}/signals/{signalSlug}/upvotes
```

Requires the `signals:upvote` scope, and applies to your own signals only.

```bash
curl -X PUT https://<hypha-host>/api/v1/spaces/acme-dao/signals/coh-1a2b3c4d/upvotes \
  -H "x-hypha-api-key: $HYPHA_SPACE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "voter": { "walletAddress": "0xAbC0000000000000000000000000000000000123" },
    "votingPowerPercent": 25
  }'
```

Re-sending `PUT` for the same voter updates their allocation rather than adding a second vote.

```bash
# DELETE bodies are awkward in some clients, so a query parameter works too.
curl -X DELETE "https://<hypha-host>/api/v1/spaces/acme-dao/signals/coh-1a2b3c4d/upvotes?voter=0xAbC0000000000000000000000000000000000123" \
  -H "x-hypha-api-key: $HYPHA_SPACE_API_KEY"
```

Both return the recalculated upvote summary:

```json
{
  "upvotes": {
    "totalVotingPower": "250000000000000000000",
    "upvoteCount": 1,
    "tokenDecimals": 18,
    "voters": [{ "personId": 3, "name": "Ada L", "votingPower": "250000000000000000000" }],
    "myUpvote": { "votingPower": "250000000000000000000", "maxVotingPower": "1000000000000000000000" }
  }
}
```

### Weight is decided on-chain, not by your app

`votingPowerPercent` (1–100, default 100) is a **share of the voting power that voter genuinely
holds**, read live from the space's on-chain voting power source — the same source Hypha uses to
tally proposals. Your app cannot inflate anyone's weight; a voter with no voting power in the space
gets `422`. This mirrors Hypha's own upvote path exactly, since both call the same code.

**What the key is trusted with.** Hypha authenticates your app, not the individual voter: there is no
per-vote wallet signature. A key with `signals:upvote` can therefore record an upvote for any member
of its space, bounded by that member's real weight and by one vote per person. Establishing that a
member actually intended the vote is your app's job — the same trust you place in it when it publishes
signals on their behalf. Grant `signals:upvote` only to apps whose own authentication you rely on, and
omit the scope entirely for apps that merely publish.

---

## Status codes

| Code | Meaning |
| --- | --- |
| `200` | Update, upvote, or idempotent create replay succeeded. |
| `201` | Signal created. |
| `400` | Malformed JSON, failed validation, unknown field, or a status/board slug the space does not define. |
| `401` | Missing, unknown, or revoked API key. |
| `403` | Key belongs to another space, lacks the required scope, or the signal is not yours. |
| `404` | Space or signal not found. |
| `409` | Signal is archived, or the space is not linked to an on-chain space (upvotes only). |
| `422` | The voter has no matching Hypha profile, or no voting power. (Authors never fail — they fall back to the space.) |
| `500` | Unexpected server error. |

---

## Checklist for integrators

1. Ask Hypha for a key, choosing a stable `source` slug for your app.
2. Store the key in server-side secrets only.
3. Make sure your members' Hypha profiles carry the wallet address or email your app knows them by —
   otherwise their signals are published as the space.
4. Send `externalId` on every create so retries are safe and updates are possible.
5. Treat ingestion as best-effort in your own flow: never fail a user action because Hypha was
   briefly unreachable — queue and retry instead.
6. Watch `attributedTo` on creates; a run of `"space"` means your identity mapping has drifted.
7. On `422` from an upvote, surface a "connect your Hypha profile" prompt rather than retrying blindly.
