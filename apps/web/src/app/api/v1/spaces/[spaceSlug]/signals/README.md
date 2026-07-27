# Signals Ingestion API

Let a community's **own app** publish signals onto the Hypha **Signals Board** of one Space.

Ingested signals are written into the same `coherences` table the board already reads, so they show
up in the Coherence tab at `/{lang}/dho/{spaceSlug}/coherence` next to signals raised inside Hypha.
There is no separate view and no sync step.

**Base URL (production):** `https://app.hypha.earth`
**Auth:** per-space API key, issued by Hypha ops
**Scopes:** `signals:write` (create + update), `signals:upvote` (record + remove upvotes)

```
Community app ──x-hypha-api-key──▶ POST /api/v1/spaces/{spaceSlug}/signals
                                      │
                                      ├─ verify key + scope against this space
                                      ├─ credit a known Hypha person, else the space
                                      └─ insert into coherences (source = <your slug>)
                                            │
                                            ▼
                                     Signals Board (existing UI)
```

There are two sides to setting this up. **Part 1** is what you do inside Hypha. **Part 2** is what
the other app's developer does. You can hand Part 2, or
[`docs/integrations/external-signal-ingestion.md`](../../../../../../../../../docs/integrations/external-signal-ingestion.md),
straight to them — it contains no Hypha-internal detail.

---

# Part 1 — What to do on the Hypha side

## Step 1: Confirm the migration is applied

The key table and the ownership columns ship in `0074_space_api_keys_and_signal_source.sql`.

```bash
pnpm --filter @hypha-platform/storage-postgres run migrate
```

Verify against the target database:

```sql
select table_name from information_schema.tables where table_name = 'space_api_keys';
select column_name from information_schema.columns
  where table_name = 'coherences' and column_name in ('source', 'external_id');
```

You want one row from the first query and two from the second. Nothing works before this.

## Step 2: Set the ops secret

Issuing keys is guarded by a single platform secret, `HYPHA_SPACE_API_KEY_OPS_SECRET`. Generate one:

```bash
openssl rand -base64 32
```

Set it where the app runs:

- **Production / Preview:** Vercel project → Settings → Environment Variables (server-side, _not_
  `NEXT_PUBLIC_`). **Redeploy** afterwards — env changes only reach new deployments.
- **Local:** add it to `apps/web/.env` (the key already exists, unset, in `.env.template`).

Until it is set, the ops endpoints answer `503 HYPHA_SPACE_API_KEY_OPS_SECRET is not configured`.

Keep this secret to the ops team. It can mint write credentials for **every** space.

## Step 3: Find the space slug

It is the segment in the space URL: `https://app.hypha.earth/en/dho/**acme-dao**/coherence` →
`acme-dao`. Everything below is scoped to that one space.

## Step 4: Agree a `source` slug with the integrator

`source` is a stable identifier for their app, e.g. `acaw-contest`. It is stamped on every signal the
key writes, and it is what later proves they own those signals — they can only update and upvote
rows carrying their own `source`.

Rules: lowercase letters, numbers and hyphens, must start alphanumeric, 1–64 characters. **One active
key per `source` per space.** Pick it once; changing it later orphans every signal already written
under the old value.

## Step 5: Issue the key

```bash
export HYPHA_SPACE_API_KEY_OPS_SECRET='<the secret from step 2>'

curl -X POST https://app.hypha.earth/api/v1/ops/spaces/acme-dao/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "ACAW contest app",
    "source": "acaw-contest",
    "scopes": ["signals:write", "signals:upvote"]
  }'
```

`201 Created` — and this is the **only** time `apiKey` is ever returned:

```json
{
  "key": {
    "id": 12,
    "spaceId": 42,
    "name": "ACAW contest app",
    "source": "acaw-contest",
    "keyPrefix": "K3nQ7bTz",
    "scopes": ["signals:write", "signals:upvote"],
    "createdByPersonId": null,
    "lastUsedAt": null,
    "revokedAt": null,
    "createdAt": "2026-07-27T12:00:00.000Z"
  },
  "apiKey": "hyk_K3nQ7bTz_x9f…",
  "warning": "Store this key now — it is not recoverable. Never expose it in client-side code."
}
```

Only a SHA-256 digest is stored. If the plaintext is lost, revoke the key and issue a new one —
there is no recovery path.

Grant `signals:write` alone if the app only files signals and should not vote.

| Response | Meaning                                                                   |
| -------- | ------------------------------------------------------------------------- |
| `201`    | Key issued. Capture `apiKey` now.                                         |
| `400`    | Bad `name`/`source`/`scopes` — see `details` (Zod flatten).               |
| `401`    | Ops secret missing or wrong.                                              |
| `404`    | No space with that slug.                                                  |
| `409`    | An active key already exists for that `source`. Revoke it first (step 9). |
| `503`    | `HYPHA_SPACE_API_KEY_OPS_SECRET` not configured on this deployment.       |

## Step 6: Hand over the credentials

Send the integrator, over a secure channel:

| What                                   | Example                                                             |
| -------------------------------------- | ------------------------------------------------------------------- |
| Base URL                               | `https://app.hypha.earth`                                           |
| Space slug                             | `acme-dao`                                                          |
| API key                                | `hyk_K3nQ7bTz_x9f…`                                                 |
| Their `source`                         | `acaw-contest` (informational — the server derives it from the key) |
| Valid `progressStatus` / `board` slugs | see step 7                                                          |

Tell them plainly: **the key is server-side only.** It grants write access to the space. Hypha spaces
can be fully public, so anything reachable from a browser is effectively published.

## Step 7: Give them the space's workflow slugs

`progressStatus` and `board` must be slugs this space actually defines, or the create fails with
`400 Unknown progress status …`. Both are optional — omitted, a signal lands on the space's first
backlog status and default board.

Defaults for a space that has never customised its workflow:

- **statuses:** `backlog`, `todo`, `in_progress`, `blocked`, `done`
- **boards:** `general`

If the space has customised them, read the live config and pass the slugs along:

```bash
curl https://app.hypha.earth/api/v1/spaces/acme-dao/signal-workflow
```

Do this yourself rather than asking the integrator to: that endpoint is gated by space
transparency, not by the API key, so a private space will refuse them.

## Step 8: Verify end to end

Post a test signal with the key you just issued:

```bash
export HYPHA_SPACE_API_KEY='hyk_K3nQ7bTz_x9f…'

curl -X POST https://app.hypha.earth/api/v1/spaces/acme-dao/signals \
  -H "x-hypha-api-key: $HYPHA_SPACE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Integration smoke test",
    "description": "Delete me once the board shows this.",
    "type": "Insight",
    "externalId": "smoke-test-1"
  }'
```

Then check, in order:

1. The response is `201` and carries a `url`. Open it — the signal should be on the board.
2. `attributedTo` is `"space"` here (no `author` was sent), and the card shows the **space's name and
   logo** as the author.
3. Re-run the exact same command. You should get `200` and the _same_ `id` — idempotency works.
4. Repeat with `"author": { "walletAddress": "<a real member's wallet>" }` and a new `externalId`.
   Expect `attributedTo: "author"` and that member's name on the card.
5. Archive or delete the test signals from the Hypha UI.

If the board is empty but the API returned `201`, check that Coherence is not switched off for this
deployment: it defaults **on**, but `NEXT_PUBLIC_ENABLE_COHERENCE=false` (or an `enable-coherence`
toolbar override) hides the tab. The row is still in the database.

For upvotes to mirror on-chain the space must be linked to an on-chain space (`web3SpaceId`).
Unlinked spaces answer `409` on upvote calls; creating and updating signals still works.

## Step 9: List, revoke, rotate

```bash
# Metadata only — never key material. Includes lastUsedAt, useful to confirm traffic.
curl https://app.hypha.earth/api/v1/ops/spaces/acme-dao/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET"

# Revoke by key id. Takes effect immediately; the key then fails with 401.
curl -X DELETE https://app.hypha.earth/api/v1/ops/spaces/acme-dao/api-keys/12 \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET"
```

**To rotate,** revoke the old key and issue a new one with the **same `source`** — ownership of
existing signals is carried by `source`, not by the key id, so the app keeps its ability to update
and vote on everything it filed before. There is no overlap window: coordinate the swap, because the
old key stops working the moment it is revoked.

Revoking is the correct response to a leaked key. Signals already written stay on the board.

---

# Part 2 — Integrating from another app

## Authentication

Every request carries the key:

```http
x-hypha-api-key: hyk_<prefix>_<secret>
```

`Authorization: Bearer <key>` is also accepted, for clients that only do bearer auth.

The key is valid for **one space**. Presented against a different space it fails with `403`.

## The three calls

```http
POST   /api/v1/spaces/{spaceSlug}/signals                          # create (idempotent)
PATCH  /api/v1/spaces/{spaceSlug}/signals/{signalSlug}             # update your own
PUT    /api/v1/spaces/{spaceSlug}/signals/{signalSlug}/upvotes     # record an upvote
DELETE /api/v1/spaces/{spaceSlug}/signals/{signalSlug}/upvotes     # remove an upvote
```

## Create fields

| Field            | Required | Notes                                                                                       |
| ---------------- | -------- | ------------------------------------------------------------------------------------------- |
| `title`          | **yes**  | 1–**50** characters. Board cards are sized for short titles — truncate, or you get a `400`. |
| `description`    | **yes**  | 1–4000 characters.                                                                          |
| `type`           | **yes**  | `Opportunity`, `Risk`, `Tension`, `Insight`.                                                |
| `priority`       | no       | `critical`, `high`, `medium` (default), `low`.                                              |
| `tags`           | no       | Free strings, max 50. `External Signal` is appended automatically.                          |
| `externalId`     | no       | **Send it.** Your own record id — makes retries idempotent and updates possible.            |
| `author`         | no       | `{ walletAddress }` or `{ email }`. Unknown or omitted → published as the space.            |
| `progressStatus` | no       | A status slug the space defines. Ask Hypha which.                                           |
| `board`          | no       | A board (swimlane) slug the space defines.                                                  |
| `dueAt`          | no       | ISO 8601 timestamp, or `null`.                                                              |

Bodies are strict: an unknown field (`prioriy`) is a `400`, never a silent drop. Assignees stay a
Hypha-side concern and cannot be set here.

## Attribution — who the board credits

Name the person with the wallet or email **they use on Hypha**. If it matches, the signal is credited
to that member. If it matches nobody, or you send no `author` at all, the signal is still created and
credited to **the space itself**, appearing under the space's name and logo with no voting power.

So ingestion never fails over an identity mismatch — but it also silently stops naming individuals.
Every create response tells you which happened:

```json
{ "attributedTo": "author" }   // matched a Hypha member
{ "attributedTo": "space" }    // published as the space
```

Log it. A run of `"space"` means your identity mapping has drifted, not that Hypha is broken.

Upvotes are stricter: a voter **must** resolve to a real Hypha member with on-chain voting power,
otherwise `422`. An upvote only means something as one member's weight.

## A working client

Server-side only. No dependencies beyond `fetch` (Node 18+).

```ts
// lib/hypha-signals.ts
const BASE_URL = process.env.HYPHA_BASE_URL ?? 'https://app.hypha.earth';
const SPACE_SLUG = requireEnv('HYPHA_SPACE_SLUG');
const API_KEY = requireEnv('HYPHA_SPACE_API_KEY');

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export type SignalType = 'Opportunity' | 'Risk' | 'Tension' | 'Insight';
export type SignalPriority = 'critical' | 'high' | 'medium' | 'low';
export type AuthorRef = { walletAddress?: string; email?: string };

export type PublishSignalInput = {
  /** Your own record id. Makes retries safe and lets you update later. */
  externalId: string;
  title: string;
  description: string;
  type: SignalType;
  priority?: SignalPriority;
  tags?: string[];
  progressStatus?: string;
  board?: string;
  dueAt?: string | null;
  author?: AuthorRef;
};

export type PublishedSignal = {
  id: number;
  slug: string;
  spaceSlug: string;
  /** Deep link to the signal on the board — good for linking your users into Hypha. */
  url: string;
  attributedTo: 'author' | 'space';
};

export class HyphaSignalError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
    this.name = 'HyphaSignalError';
  }

  /** 5xx and 429 are worth retrying; a 4xx means fix the request. */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'x-hypha-api-key': API_KEY,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new HyphaSignalError(`Hypha ${method} ${path} failed with ${response.status}`, response.status, text);
  }
  return (text ? JSON.parse(text) : null) as T;
}

const signalsPath = `/api/v1/spaces/${SPACE_SLUG}/signals`;

/**
 * Create a signal, or return the existing one when this `externalId` was already
 * sent. Safe to call again after a timeout.
 */
export function publishSignal(input: PublishSignalInput): Promise<PublishedSignal> {
  return call<PublishedSignal>('POST', signalsPath, {
    ...input,
    title: input.title.slice(0, 50),
  });
}

/** Patch a signal your app created. Omitted fields keep their stored values. */
export function updateSignal(signalSlug: string, patch: Partial<Pick<PublishSignalInput, 'title' | 'description' | 'type' | 'priority' | 'tags' | 'progressStatus' | 'board' | 'dueAt'>> & { archived?: boolean }): Promise<{ signal: unknown }> {
  return call('PATCH', `${signalsPath}/${signalSlug}`, patch);
}

/** Record (or re-allocate) one member's upvote. Requires `signals:upvote`. */
export function upvoteSignal(signalSlug: string, walletAddress: string, votingPowerPercent?: number): Promise<{ upvotes: unknown }> {
  return call('PUT', `${signalsPath}/${signalSlug}/upvotes`, {
    voter: { walletAddress },
    ...(votingPowerPercent === undefined ? {} : { votingPowerPercent }),
  });
}

export function removeUpvote(signalSlug: string, walletAddress: string): Promise<{ upvotes: unknown }> {
  const query = `?voter=${encodeURIComponent(walletAddress)}`;
  return call('DELETE', `${signalsPath}/${signalSlug}/upvotes${query}`);
}

/** Retry transient failures with backoff. Never retries a 4xx. */
export async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof HyphaSignalError) || error.retryable;
      if (!retryable || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));
    }
  }
  throw lastError;
}
```

### Calling it

```ts
import { publishSignal, withRetry } from '@/lib/hypha-signals';

export async function onContestSubmission(submission: Submission) {
  const signal = await withRetry(() =>
    publishSignal({
      externalId: `submission-${submission.id}`,
      title: submission.headline,
      description: submission.body,
      type: 'Opportunity',
      priority: submission.urgent ? 'high' : 'medium',
      tags: ['Contest', submission.category],
      author: { email: submission.authorEmail },
    }),
  );

  if (signal.attributedTo === 'space') {
    console.warn('Signal published as the space', {
      submissionId: submission.id,
      email: submission.authorEmail,
    });
  }

  return signal.url; // link the user straight to the board
}
```

### Python equivalent

```python
import os, json, urllib.request

BASE_URL = os.environ.get("HYPHA_BASE_URL", "https://app.hypha.earth")
SPACE_SLUG = os.environ["HYPHA_SPACE_SLUG"]
API_KEY = os.environ["HYPHA_SPACE_API_KEY"]

def publish_signal(payload: dict) -> dict:
    url = f"{BASE_URL}/api/v1/spaces/{SPACE_SLUG}/signals"
    request = urllib.request.Request(
        url,
        method="POST",
        data=json.dumps(payload).encode(),
        headers={"x-hypha-api-key": API_KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())

signal = publish_signal({
    "externalId": "submission-42",
    "title": "Riverside cleanup needs funding"[:50],
    "description": "Twelve members flagged the riverside site this week.",
    "type": "Opportunity",
    "author": {"email": "member@example.org"},
})
print(signal["url"], signal["attributedTo"])
```

## Where to call it from

Publish from your **server**, after your own write commits — a route handler, a queue worker, or a
webhook. Two rules:

- **Never fail a user action because Hypha was unreachable.** Enqueue and retry; the board is a
  mirror, not your source of truth.
- **Store the returned `slug`** against your record. You need it to update the signal or move it
  through the workflow later.

Because `externalId` makes creates idempotent, a worker can safely replay its queue.

## Troubleshooting

| Status | What it means                                                          | What to do                                                                                            |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `400`  | Validation failed, unknown field, or an undefined status/board slug    | Read `details`; check `title` ≤ 50 chars and that your `progressStatus`/`board` slugs match the space |
| `401`  | Key missing, unknown, or revoked                                       | Check the header name and that ops has not revoked the key                                            |
| `403`  | Key is for another space, lacks the scope, or the signal is not yours  | You can only touch signals your own `source` created                                                  |
| `404`  | Space or signal not found                                              | Check the space slug and that you stored the right signal slug                                        |
| `409`  | Signal is archived, or the space is not linked on-chain (upvotes only) | Nothing to retry; ask Hypha to link the space                                                         |
| `422`  | Voter has no Hypha profile or no voting power                          | Prompt the user to connect their Hypha profile — do not retry                                         |
| `500`  | Unexpected server failure                                              | Retry with backoff                                                                                    |

Validation failures carry `{ "error": "Validation failed", "details": … }` (Zod flatten). Other
errors are `{ "error": "…" }`.

## Local testing

Against a dev server, everything is identical with `BASE_URL=http://localhost:3000` — issue a key
with the ops secret from `apps/web/.env`:

```bash
curl -X POST http://localhost:3000/api/v1/ops/spaces/<spaceSlug>/api-keys \
  -H "x-hypha-ops-secret: $HYPHA_SPACE_API_KEY_OPS_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "local dev", "source": "local-dev", "scopes": ["signals:write"] }'
```

---

## Related

- [`docs/integrations/external-signal-ingestion.md`](../../../../../../../../../docs/integrations/external-signal-ingestion.md)
  — the full integrator reference, safe to share outside the team.
- Route handlers: `route.ts` (create), `[signalSlug]/route.ts` (update),
  `[signalSlug]/upvotes/route.ts` (upvotes), `_lib/authorize-ingestion.ts` (key + attribution).
- Key administration: `apps/web/src/app/api/v1/ops/spaces/[spaceSlug]/api-keys/`.
