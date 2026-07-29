# Hypha Signals API — build spec for an AI coding agent

**This file is written to be given to an AI coding agent** (Lovable, Cursor, Claude Code) that is
building **the other app** — the community app that publishes signals into Hypha. It is a
specification, not a tutorial: every rule is explicit, every field is bounded, and the expected
implementation is given in full.

Humans wanting the narrative version: `docs/integrations/external-signal-ingestion.md`.

---

## 1. What you are building

The app you are working on must publish **signals** to a Hypha Space's **Signals Board**.

A signal is one short post: a title, a description, a type, and optionally who raised it. One
`POST` per signal. Once posted, it appears on that Space's board in Hypha, next to signals raised by
members inside Hypha. There is nothing to sync and nothing to poll.

You will build exactly two things:

1. A **server-side function** that holds the Hypha API key and forwards signals to Hypha.
2. A **client call** to that function, at the point in the app where a signal is produced.

---

## 2. Hard rules

Violating any of these breaks the integration or leaks a credential.

1. **The API key is a server-side secret.** Never put it in frontend code, never in a `VITE_*` or
   `NEXT_PUBLIC_*` variable, never in a committed file, never in a client-side `fetch`. In a Lovable
   app this means the key lives in a **Lovable Cloud / Supabase Edge Function secret** and every
   Hypha call happens inside that Edge Function. A Hypha Space can be fully public, so a key
   reachable from a browser is a published key.
2. **Keep JWT verification enabled** on that Edge Function (Supabase's default). Otherwise anyone on
   the internet can call it and spam the Space's board. Only signed-in users of your app may publish.
3. **Always send `externalId`.** It is your own record id for the thing the signal describes. It
   makes retries safe (see §5) and it is the only way to update the signal later.
4. **`title` is limited to 50 characters.** Truncate before sending, or the request fails. The
   description is where the detail goes.
5. **`type` must be exactly one of** `Opportunity`, `Risk`, `Tension`, `Insight`. No other value is
   accepted. Match case exactly.
6. **Never invent fields.** The request body is strict — an unrecognised field (e.g. `prioriy`,
   `authorName`, `spaceId`) fails the whole request with `400`.
7. **Never retry a `4xx`.** A `4xx` means the request is wrong and will fail identically forever.
   Retry only `5xx` and `429`, with backoff.
8. **Never block or fail a user action because Hypha was unreachable.** Publishing is a mirror of
   your own data, not your source of truth. Save your record first, then publish.

---

## 3. Configuration

The human operating the app supplies these three values. Store them as **Edge Function secrets**.
Do not hardcode them, and do not guess them.

| Secret name           | Example                   | Notes                                        |
| --------------------- | ------------------------- | -------------------------------------------- |
| `HYPHA_BASE_URL`      | `https://app.hypha.earth` | Production Hypha                             |
| `HYPHA_SPACE_SLUG`    | `acme-dao`                | Which Space the signals land in              |
| `HYPHA_SPACE_API_KEY` | `hyk_<prefix>_<secret>`   | Per-Space key. Valid for that one Space only |

If any is missing, fail fast with a clear error at startup of the function. Do not fall back to a
placeholder and do not proceed.

---

## 4. The API contract

### Create a signal

```http
POST {HYPHA_BASE_URL}/api/v1/spaces/{HYPHA_SPACE_SLUG}/signals
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
Content-Type: application/json
```

Body:

```json
{
  "externalId": "submission-42",
  "title": "Riverside cleanup needs funding",
  "description": "Twelve members flagged the riverside site this week.",
  "type": "Opportunity",
  "priority": "high",
  "tags": ["Contest", "Fundraising"],
  "author": { "email": "member@example.org" }
}
```

| Field            | Required            | Type / allowed values                              | Limits                         |
| ---------------- | ------------------- | -------------------------------------------------- | ------------------------------ |
| `title`          | **yes**             | string                                             | 1–**50** chars — truncate      |
| `description`    | **yes**             | string                                             | 1–4000 chars                   |
| `type`           | **yes**             | `Opportunity` \| `Risk` \| `Tension` \| `Insight`  | exact case                     |
| `externalId`     | _treat as required_ | string                                             | 1–200 chars, unique per signal |
| `priority`       | no                  | `critical` \| `high` \| `medium` \| `low`          | defaults to `medium`           |
| `tags`           | no                  | string[]                                           | max 50 items                   |
| `author`         | no                  | `{ "walletAddress": "0x…" }` or `{ "email": "…" }` | see §6                         |
| `dueAt`          | no                  | ISO 8601 string, or `null`                         | —                              |
| `progressStatus` | no                  | a status slug the Space defines                    | ask the human; omit if unsure  |
| `board`          | no                  | a board slug the Space defines                     | ask the human; omit if unsure  |

Omit any optional field you have no real value for. Do not send `null` to mean "unset" (only `dueAt`
accepts `null`).

**Response `201`** (created) or **`200`** (this `externalId` was already published):

```json
{
  "id": 501,
  "slug": "coh-1a2b3c4d",
  "spaceSlug": "acme-dao",
  "url": "https://app.hypha.earth/en/dho/acme-dao/coherence?signal=coh-1a2b3c4d",
  "attributedTo": "author",
  "signal": { "…": "full record" }
}
```

Store `slug` against your record — you need it to update the signal later. `url` deep-links to the
signal on the board; show it to the user if useful.

### Update a signal you created (optional)

```http
PATCH {HYPHA_BASE_URL}/api/v1/spaces/{HYPHA_SPACE_SLUG}/signals/{slug}
```

Send only the fields that changed: `title`, `description`, `type`, `priority`, `tags`,
`progressStatus`, `board`, `dueAt`, `archived`. You may only patch signals your own key created;
anything else returns `403`.

### Upvotes (only build this if asked)

```http
PUT    {…}/signals/{slug}/upvotes   body: { "voter": { "walletAddress": "0x…" }, "votingPowerPercent": 25 }
DELETE {…}/signals/{slug}/upvotes?voter=0x…
```

Unlike authors, a voter **must** be an existing Hypha member with on-chain voting power, or you get
`422`. Do not retry a `422`; surface "connect your Hypha profile" to the user instead.

---

## 5. Idempotency — why `externalId` matters

`(Space, your app, externalId)` is unique in Hypha. Send the same `externalId` twice and the second
call returns `200` with the signal that already exists, rather than creating a duplicate.

This is what makes the integration safe: if a request times out, or a queue redelivers, or a user
double-clicks, you can send the exact same payload again with no duplicate on the board. Use a stable
id from your own database (`submission-42`, `idea-a1b2c3`), never a timestamp or a random value.

Without `externalId` every call creates a new signal and you can never update it.

---

## 6. Who gets credited on the board

`author` names the person who raised the signal, by the **wallet address or email they use on
Hypha**:

- **It matches a Hypha member** → the signal is credited to that member. Response says
  `"attributedTo": "author"`.
- **It matches nobody, or you omit `author`** → the signal is still created, credited to **the Space
  itself**, shown under the Space's name and logo. Response says `"attributedTo": "space"`.

So a wrong or unknown author never fails the request — it silently changes who is credited.
Therefore: **log `attributedTo` on every create.** If it is `"space"` when you expected `"author"`,
the app's email/wallet does not match that person's Hypha profile. That is a data problem to report,
not an error to retry.

If the app has no user identity at all, omit `author` — publishing as the Space is the intended
behaviour, not a workaround.

---

## 7. Reference implementation

### Edge Function — `supabase/functions/publish-signal/index.ts`

```ts
// No fallback for any of the three: guessing the host would publish a staging
// app's signals into production, or fail with a confusing 404.
const BASE_URL = Deno.env.get('HYPHA_BASE_URL');
const SPACE_SLUG = Deno.env.get('HYPHA_SPACE_SLUG');
const API_KEY = Deno.env.get('HYPHA_SPACE_API_KEY');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SIGNAL_TYPES = ['Opportunity', 'Risk', 'Tension', 'Insight'] as const;
type SignalType = (typeof SIGNAL_TYPES)[number];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);

  if (!BASE_URL || !SPACE_SLUG || !API_KEY) {
    console.error('Missing a HYPHA_BASE_URL, HYPHA_SPACE_SLUG or HYPHA_SPACE_API_KEY secret');
    return json({ error: 'Signals publishing is not configured' }, 500);
  }

  let input: Record<string, unknown>;
  try {
    const parsed = await request.json();
    // `null` and arrays are valid JSON but not valid bodies; reading fields off
    // them would throw or coerce into nonsense like "[object Object]".
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Body must be a JSON object' }, 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const externalId = str(input.externalId);
  const title = str(input.title);
  const description = str(input.description);
  const type = str(input.type) as SignalType;

  if (!externalId || !title || !description) {
    return json({ error: 'externalId, title and description must be non-empty strings' }, 400);
  }
  if (!SIGNAL_TYPES.includes(type)) {
    return json({ error: `type must be one of ${SIGNAL_TYPES.join(', ')}` }, 400);
  }

  // Build the payload explicitly. Never forward the caller's object wholesale:
  // an unexpected field makes Hypha reject the whole request.
  const payload: Record<string, unknown> = {
    externalId,
    title: title.slice(0, 50),
    description: description.slice(0, 4000),
    type,
  };
  if (typeof input.priority === 'string') payload.priority = input.priority;
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    payload.tags = input.tags.filter((tag) => typeof tag === 'string').slice(0, 50);
  }
  if (input.author && typeof input.author === 'object' && !Array.isArray(input.author)) {
    payload.author = input.author;
  }
  if (typeof input.progressStatus === 'string') payload.progressStatus = input.progressStatus;
  if (typeof input.board === 'string') payload.board = input.board;
  // `null` is meaningful here — it clears a due date — so pass it through.
  if (input.dueAt === null || typeof input.dueAt === 'string') payload.dueAt = input.dueAt;

  const response = await fetch(`${BASE_URL}/api/v1/spaces/${SPACE_SLUG}/signals`, {
    method: 'POST',
    headers: {
      'x-hypha-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON body (a gateway error page); the status is all we can rely on.
  }

  if (!response.ok) {
    // Never log the raw body or the author: both carry the signal's content and
    // the member's email or wallet, and function logs are widely readable.
    console.error('Hypha rejected the signal', {
      status: response.status,
      externalId,
    });
    const retryable = response.status >= 500 || response.status === 429;
    // Pass the status through so the caller can tell "fix the payload" (400)
    // from "connect your profile" (422) from "re-check the key" (401).
    return json(
      {
        error: 'Could not publish to Hypha',
        status: response.status,
        retryable,
        details: body.details ?? null,
      },
      retryable ? 503 : response.status,
    );
  }

  const signal = body;
  if (signal.attributedTo === 'space') {
    console.warn('Signal credited to the Space, not the author', {
      externalId,
      authorProvided: Boolean(payload.author),
    });
  }

  return json({
    slug: signal.slug,
    url: signal.url,
    attributedTo: signal.attributedTo,
  });
});
```

### Client call

```ts
import { supabase } from '@/integrations/supabase/client';

export async function publishSignal(submission: { id: string; headline: string; body: string; authorEmail?: string }) {
  const { data, error } = await supabase.functions.invoke('publish-signal', {
    body: {
      externalId: `submission-${submission.id}`,
      title: submission.headline,
      description: submission.body,
      type: 'Opportunity',
      priority: 'medium',
      ...(submission.authorEmail ? { author: { email: submission.authorEmail } } : {}),
    },
  });

  if (error) {
    // Never surface this as a failure of the user's own action.
    console.error('Publishing to Hypha failed', error);
    return null;
  }
  return data as { slug: string; url: string; attributedTo: string };
}
```

Call it **after** your own record is saved, and ignore its failure for the user's flow.

---

## 8. Errors

| Status        | Meaning                                                                                                          | Correct response                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `400`         | Validation failed, unknown field, `title` over 50 chars, or a `progressStatus`/`board` the Space does not define | Fix the payload. Never retry unchanged          |
| `401`         | Key missing, wrong, or revoked                                                                                   | Stop. Ask the human to re-check the secret      |
| `403`         | Key belongs to another Space, lacks the scope, or the signal is not yours                                        | Stop. Do not retry                              |
| `404`         | Space slug wrong, or signal slug wrong                                                                           | Stop. Verify configuration                      |
| `409`         | Signal is archived, or the Space is not linked on-chain (upvotes only)                                           | Stop. Not retryable                             |
| `422`         | Voter has no Hypha profile or no voting power (upvotes only)                                                     | Prompt the user, do not retry                   |
| `429` / `5xx` | Transient                                                                                                        | Retry with exponential backoff, max ~3 attempts |

Validation failures return `{ "error": "Validation failed", "details": { … } }`. Read `details` — it
names the offending field.

The Edge Function above forwards Hypha's status and `details` to its own caller (as
`{ error, status, retryable, details }`), so the client can tell a payload bug from a `422` that needs
a user prompt. It deliberately does not forward the raw response body.

---

## 9. Definition of done

Do not report the integration complete until all of these hold:

- [ ] `HYPHA_SPACE_API_KEY` appears **only** in Edge Function secrets. Searching the frontend bundle
      and the repository for `hyk_` returns nothing.
- [ ] JWT verification is enabled on the Edge Function; an unauthenticated call is rejected.
- [ ] Publishing a signal returns a `url`, and opening that URL shows the signal on the Hypha board.
- [ ] Publishing the **same** `externalId` twice creates **one** signal on the board.
- [ ] `title` longer than 50 characters is truncated by your code, not rejected by Hypha.
- [ ] `attributedTo` is logged on every publish.
- [ ] A forced Hypha failure (e.g. a bad key) does **not** break or roll back the user's own action.
- [ ] No `4xx` is ever retried.

---

## 10. Prompt to paste into the AI agent

> Integrate Hypha Signals into this app.
>
> Goal: when a user submits **\<the thing your app produces\>**, publish it as a signal to our Hypha
> Space so it appears on our Signals Board.
>
> Follow the specification in this file exactly. Specifically:
>
> - Put the Hypha API key in an Edge Function secret. It must never reach the browser.
> - Keep JWT verification on that function enabled.
> - Send `externalId` set to our own record id so retries never duplicate.
> - Truncate `title` to 50 characters.
> - Use `type` from `Opportunity | Risk | Tension | Insight` only.
> - Send `author` as `{ email }` using the email on the user's account, and log `attributedTo` from
>   the response.
> - Publish after our own save succeeds, and never fail the user's action if Hypha is down.
>
> Secrets I will provide: `HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG`, `HYPHA_SPACE_API_KEY`.
>
> When done, walk me through the Definition of done checklist in §9.
