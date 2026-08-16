# Hypha Space Intelligence API — build spec for an AI coding agent

**This file is written to be given to an AI coding agent** (Lovable, Cursor, Claude Code) that is
building **the other app** — an Intelligence Business App (IBA) that promotes meaning into a Hypha
Space’s org memory. It is a specification, not a tutorial: every rule is explicit, every field is
bounded, and the expected implementation is given in full.

Humans wanting the narrative version: `docs/integrations/external-intelligence-ingestion.md`.

**This is not the Signals API.** Signals are short board posts (`POST /signals`). Intelligence
artifacts are Markdown files on the Memory tab (`POST /intelligence`). Do not send signal fields
(`externalId`, `description`, `Opportunity`, …) here, and do not send intelligence fields to
Signals.

---

## 1. What you are building

Your app has **its own database**. Interviews, scores, PII, and operational rows stay there. Hypha
never stores that schema.

What you promote to Hypha is **shared meaning**: a Markdown artifact (typically an `assessment` or
`insight`) that space members can read on the Memory tab, and that Hypha AI and other apps can
`GET` / `memory.read`.

You will build exactly two things:

1. A **server-side function** that holds the Hypha API key and calls Hypha.
2. A **client call** to that function **after** your own record is saved, at the point the user
   chooses “publish to org memory” (or equivalent).

Do not sync your whole database. Do not poll Hypha. One `POST` per promotion.

---

## 2. Hard rules

Violating any of these breaks the integration or leaks a credential.

1. **The API key is a server-side secret.** Never put it in frontend code, never in a `VITE_*` or
   `NEXT_PUBLIC_*` variable, never in a committed file, never in a client-side `fetch`. In a Lovable
   app the key lives in a **Lovable Cloud / Supabase Edge Function secret** and every Hypha call
   happens inside that Edge Function. A Hypha Space can be fully public, so a key reachable from a
   browser is a published key.
2. **Keep JWT verification enabled** on that Edge Function (Supabase's default). Otherwise anyone on
   the internet can write into the Space’s org memory.
3. **Never send YAML identity fields.** Do not set `space`, `source_app`, `status`, `version`,
   `created_at`, or `updated_at`. The server assigns `id` (unless you send a stable `id`), stamps
   `source_app` from the key, and forces `status: draft`. Prefer structured JSON (`title`, `type`,
   `body`, …) so you do not invent frontmatter.
4. **Never publish to `current`.** Do not send `"mode": "publish"`. Do not send `expectedSha` on
   create (that looks like an overwrite). Members publish drafts from the Memory tab.
5. **Never invent fields.** The create body is strict — an unrecognised field fails the whole
   request with `400`.
6. **Never retry a `4xx`.** A `4xx` means the request is wrong and will fail identically forever.
   Retry only `5xx` and `429`, with backoff. On `409`, reload the artifact and use the returned
   `currentSha` — do not replay the old SHA.
7. **Never block or fail a user action because Hypha was unreachable.** Org memory is a mirror of
   meaning you already stored. Save your record first, then promote.

---

## 3. Configuration

The human operating the app supplies these three values. Store them as **Edge Function secrets**.
Do not hardcode them, and do not guess them.

| Secret name           | Example                   | Notes                                             |
| --------------------- | ------------------------- | ------------------------------------------------- |
| `HYPHA_BASE_URL`      | `https://app.hypha.earth` | Production Hypha                                  |
| `HYPHA_SPACE_SLUG`    | `belica-5-0`              | Which Space the artifacts land in                 |
| `HYPHA_SPACE_API_KEY` | `hyk_<prefix>_<secret>`   | Per-Space key with `intelligence:write` (implies read) |

If any is missing, fail fast with a clear error at startup of the function. Do not fall back to a
placeholder and do not proceed.

`intelligence:write` is enough for list, read, create draft, propose, and archive. A read-only key
uses `intelligence:read` only. A `signals:*` key cannot call this API.

Auth header (either works):

```http
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
Authorization: Bearer {HYPHA_SPACE_API_KEY}
```

---

## 4. The API contract

Base path: `{HYPHA_BASE_URL}/api/v1/spaces/{HYPHA_SPACE_SLUG}/intelligence`

### 4.1 List / search

```http
GET {base}?type=assessment&status=current&search=stakeholder
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
```

| Query            | Notes                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `type`           | Optional core type filter (`assessment`, `insight`, …)                |
| `status`         | Optional (`draft`, `current`, `contested`, `superseded`, `archived`)  |
| `search` or `q`  | Optional case-insensitive filter on title, id, or tags                |
| `includeArchived`| `1` / `true` to include archived artifacts                            |

**Response `200`:**

```json
{
  "space_slug": "belica-5-0",
  "configured": true,
  "artifacts": [
    {
      "id": "stakeholder-assessment-belica-5-0",
      "type": "assessment",
      "title": "Stakeholder Assessment — Belica 5.0",
      "status": "draft",
      "sha": "a1b2c3…",
      "path": "intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-5-0.md",
      "tags": ["stakeholders", "governance"],
      "related": ["energy-stakeholder-map"]
    }
  ],
  "enabled_packs": ["hypha-energy"],
  "graph": { "nodes": [], "edges": [] }
}
```

If `configured` is `false`, blob storage is not set up on that Hypha deploy — stop and tell the
human. Do not retry.

### 4.2 Read one artifact

```http
GET {base}/{artifactId}
```

`artifactId` is the manifest `id` (slug-id), not the file path.

**Response `200`:** `{ space_slug, configured, artifact: { path, sha, frontmatter, body } }`

Store `artifact.sha`. You need it to archive or propose an update.

**Response `404`:** no such artifact.

### 4.3 Create a draft (the normal IBA write)

```http
POST {base}
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
Content-Type: application/json
```

Preferred body (no YAML):

```json
{
  "title": "Stakeholder Assessment — Belica 5.0",
  "type": "assessment",
  "body": "## Allies\n\n- …\n",
  "tags": ["stakeholders", "governance"],
  "related": ["energy-stakeholder-map"],
  "linked_signals": []
}
```

| Field             | Required                         | Limits                                      |
| ----------------- | -------------------------------- | ------------------------------------------- |
| `title`           | **yes** (with `type`)            | 1–500 chars                                 |
| `type`            | **yes** (with `title`)           | 1–64 chars; see §6                          |
| `body`            | no                               | Markdown, max 400_000 chars                 |
| `tags`            | no                               | max 20 strings, each 1–80 chars             |
| `related`         | no                               | max 50 artifact ids this file relates to    |
| `linked_signals`  | no                               | max 50 signal slugs (e.g. `coh-…`)          |
| `id`              | no                               | 1–80 chars; server slugifies from `title` if omitted |
| `markdown`        | alternative to title+type        | full file including `---` YAML; identity fields still overwritten |

Send **either** `title` + `type` (and optional `body`) **or** `markdown`. If both are sent,
structured fields win for identity; `body` / markdown content is the prose.

**Do not send:** `mode`, `expectedSha` / `expected_sha`, `source_app`, `space`, `status`,
`frontmatter` as a free object, or any unknown key.

**Response `201`:**

```json
{
  "created": true,
  "artifact": {
    "path": "intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-5-0.md",
    "sha": "a1b2c3…",
    "frontmatter": {
      "id": "stakeholder-assessment-belica-5-0",
      "type": "assessment",
      "title": "Stakeholder Assessment — Belica 5.0",
      "space": "belica-5-0",
      "source_app": "stakeholder-protocol",
      "status": "draft"
    },
    "body": "## Allies\n\n- …\n"
  }
}
```

`source_app` in the response is the key’s `source` slug — not a value you chose.

Creating the same `id` again returns **`409`** with `currentSha`. There is **no** `externalId`
idempotency on this API (unlike Signals). Use a stable `id` if you must control the slug; otherwise
treat each promotion as a new draft.

### 4.4 Propose an update to an existing artifact

IBA keys **cannot** overwrite `status: current`. To change an existing file, propose a patch on a
**signal that already exists in the space**. Members approve it on Signal detail.

If you do not have a `signalSlug`, **create a new draft** (§4.3) instead of proposing.

```http
POST {HYPHA_BASE_URL}/api/v1/spaces/{HYPHA_SPACE_SLUG}/signals/{signalSlug}/intelligence-patch
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
Content-Type: application/json
```

```json
{
  "action": "propose",
  "target_id": "stakeholder-assessment-belica-5-0",
  "expected_sha": "<sha from GET>",
  "markdown": "---\nid: stakeholder-assessment-belica-5-0\ntype: assessment\ntitle: Stakeholder Assessment — Belica 5.0\nspace: belica-5-0\nsource_app: stakeholder-protocol\nstatus: current\n---\n\n## Allies\n\nUpdated notes.\n"
}
```

`target_id` must match the frontmatter `id` inside `markdown`. `expected_sha` is the SHA from the
last successful `GET`. On `409`, read `currentSha`, `GET` again, and rebuild the proposal.

Do not send `action: "approve"` or `action: "reject"` — those return `403` for API keys.

### 4.5 Soft-archive

```http
DELETE {base}/{artifactId}?expectedSha={sha}
```

You may also send `{ "expectedSha": "…" }` in the JSON body. Hard delete is not available.

**Response `200`:** `{ space_slug, artifact_id, archived: true, sha }`

---

## 5. SHA concurrency

Every successful create/read returns `artifact.sha` (hex). Updates and deletes **require** that
value as `expectedSha` (or `expected_sha`).

| Status | Body                         | What you do                                      |
| ------ | ---------------------------- | ------------------------------------------------ |
| `409`  | `{ error, currentSha }`      | `GET` the artifact (or use `currentSha`), rebuild, send once. Never retry the old SHA. |

Two writers (you and a member, or two functions) will collide. That is expected. Last writer with a
stale SHA loses and must reload.

---

## 6. Type vocabulary

Use one of these `type` values (lowercase):

`context` · `signal` · `assessment` · `insight` · `recommendation` · `decision` · `proposal` ·
`report` · `framework`

For the stakeholder-analysis app, use **`assessment`**.

`related` is a list of other intelligence artifact ids (for example `energy-stakeholder-map` when
the Energy pack is enabled on the space). Omit it if you are not sure the target exists.
`linked_signals` is a list of Coherence signal slugs, not intelligence ids.

Statuses you will see: `draft` (what you create), `current` (member-published), `contested`,
`superseded`, `archived`.

---

## 7. Worked example — stakeholder assessment

Ops issued:

```json
{
  "name": "Stakeholder protocol",
  "source": "stakeholder-protocol",
  "scopes": ["intelligence:write"]
}
```

Your Edge Function secrets: `HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG=belica-5-0`, `HYPHA_SPACE_API_KEY`.

Interviews and scores stay in **your** DB. On “Publish to org memory”:

```http
POST /api/v1/spaces/belica-5-0/intelligence
x-hypha-api-key: hyk_…
```

```json
{
  "title": "Stakeholder Assessment — Belica 5.0",
  "type": "assessment",
  "body": "## Allies\n\n- …\n\n## Blockers\n\n- …\n",
  "tags": ["stakeholders", "governance"],
  "related": ["energy-stakeholder-map"]
}
```

A space member reviews the **draft** on the Memory tab and publishes. Hypha AI and other apps then
`GET` the `current` assessment. They never see your database.

---

## 8. Reference implementation

### Edge Function — `supabase/functions/publish-intelligence/index.ts`

```ts
const BASE_URL = Deno.env.get('HYPHA_BASE_URL');
const SPACE_SLUG = Deno.env.get('HYPHA_SPACE_SLUG');
const API_KEY = Deno.env.get('HYPHA_SPACE_API_KEY');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TYPES = [
  'context',
  'signal',
  'assessment',
  'insight',
  'recommendation',
  'decision',
  'proposal',
  'report',
  'framework',
] as const;

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
    console.error(
      'Missing a HYPHA_BASE_URL, HYPHA_SPACE_SLUG or HYPHA_SPACE_API_KEY secret',
    );
    return json({ error: 'Intelligence publishing is not configured' }, 500);
  }

  let input: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Body must be a JSON object' }, 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const title = str(input.title).slice(0, 500);
  const type = str(input.type);
  const body = typeof input.body === 'string' ? input.body.slice(0, 400_000) : '';

  if (!title || !type) {
    return json({ error: 'title and type must be non-empty strings' }, 400);
  }
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return json({ error: `type must be one of ${TYPES.join(', ')}` }, 400);
  }

  const payload: Record<string, unknown> = { title, type, body };
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    payload.tags = input.tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (Array.isArray(input.related) && input.related.length > 0) {
    payload.related = input.related
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  if (Array.isArray(input.linked_signals) && input.linked_signals.length > 0) {
    payload.linked_signals = input.linked_signals
      .filter((id) => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);
  }
  if (typeof input.id === 'string' && input.id.trim()) {
    payload.id = input.id.trim().slice(0, 80);
  }

  const response = await fetch(
    `${BASE_URL}/api/v1/spaces/${SPACE_SLUG}/intelligence`,
    {
      method: 'POST',
      headers: {
        'x-hypha-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();
  let hypha: Record<string, unknown> = {};
  try {
    hypha = JSON.parse(text);
  } catch {
    // Gateway error page; status is all we can rely on.
  }

  if (!response.ok) {
    console.error('Hypha rejected the intelligence artifact', {
      status: response.status,
    });
    const retryable = response.status >= 500 || response.status === 429;
    return json(
      {
        error: 'Could not publish to Hypha org memory',
        status: response.status,
        retryable,
        currentSha: hypha.currentSha ?? null,
      },
      retryable ? 503 : response.status,
    );
  }

  const artifact = hypha.artifact as
    | { sha?: string; path?: string; frontmatter?: { id?: string } }
    | undefined;
  return json({
    id: artifact?.frontmatter?.id,
    sha: artifact?.sha,
    path: artifact?.path,
    created: hypha.created === true,
  });
});
```

### Client call

```ts
import { supabase } from '@/integrations/supabase/client';

export async function publishIntelligence(assessment: {
  title: string;
  body: string;
  tags?: string[];
}) {
  const { data, error } = await supabase.functions.invoke('publish-intelligence', {
    body: {
      title: assessment.title,
      type: 'assessment',
      body: assessment.body,
      tags: assessment.tags,
      related: ['energy-stakeholder-map'],
    },
  });

  if (error) {
    console.error('Publishing to Hypha org memory failed', error);
    return null;
  }
  return data as { id: string; sha: string; path: string; created: boolean };
}
```

Call it **after** your own record is saved, and ignore its failure for the user's flow.

---

## 9. Errors

| Status        | Meaning                                                                 | Correct response                                      |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| `400`         | Validation failed or unknown field                                      | Fix the payload. Never retry unchanged                |
| `401`         | Key missing, wrong, or revoked                                          | Stop. Ask the human to re-check the secret            |
| `403`         | Wrong space, missing `intelligence:*` scope, spoofed `source_app`, or attempted publish | Stop. Do not retry                        |
| `404`         | Space slug wrong, or artifact id wrong                                  | Stop. Verify configuration                            |
| `409`         | SHA mismatch, or create collided with an existing `id`                  | Reload; use `currentSha`. Do not replay the old SHA   |
| `503`         | Intelligence storage not configured, or transient Hypha error           | Tell the human, or retry `5xx`/`429` with backoff     |
| `429` / `5xx` | Transient                                                               | Retry with exponential backoff, max ~3 attempts       |

---

## 10. Optional: hosted MCP

Same key, IBA-only, Streamable HTTP:

```http
POST {HYPHA_BASE_URL}/api/mcp
x-hypha-api-key: {HYPHA_SPACE_API_KEY}
Content-Type: application/json
Accept: application/json, text/event-stream
```

Tools: `memory.list`, `memory.search`, `memory.read`, `memory.create` (draft), `memory.update`
(propose; reject `publish`), `memory.delete` (archive). `space_slug` may be omitted and is inferred
from the key. `GET /api/mcp` is a public health JSON (no key). Do not call packs, roster, or
treasury tools — they are not registered here.

Prefer REST (§4–§8) for a Lovable Edge Function unless the host already speaks MCP.

---

## 11. Definition of done

Do not report the integration complete until all of these hold:

- [ ] `HYPHA_SPACE_API_KEY` appears **only** in Edge Function secrets. Searching the frontend bundle
      and the repository for `hyk_` returns nothing.
- [ ] JWT verification is enabled on the Edge Function; an unauthenticated call is rejected.
- [ ] A create with `type: "assessment"` and the stakeholder title returns `201` and
      `artifact.frontmatter.status === "draft"`.
- [ ] `source_app` in the response matches the key’s source, not a client-supplied value.
- [ ] Sending `"mode": "publish"` (if you try it) is `403`; you did not add that field in production
      code.
- [ ] A forced Hypha failure (e.g. a bad key) does **not** break or roll back the user's own action.
- [ ] No `4xx` is ever retried. A `409` reloads SHA instead of replaying.
- [ ] You did **not** call `/signals` for this feature.

---

## 12. Prompt to paste into the AI agent

> Integrate Hypha Space Intelligence (org memory) into this app. This is **not** the Signals board
> API.
>
> Goal: when a user chooses to publish meaning to the organisation (e.g. a stakeholder assessment),
> POST a **draft** Markdown artifact to our Hypha Space. Keep interviews, scores, and PII in **our**
> database.
>
> Follow the specification in this file exactly. Specifically:
>
> - Put the Hypha API key in an Edge Function secret. It must never reach the browser.
> - Keep JWT verification on that function enabled.
> - Send structured JSON: `title`, `type: "assessment"`, `body`, optional `tags` / `related`.
>   Do not send YAML identity fields, `mode`, `source_app`, or `expectedSha` on create.
> - Truncate `title` to 500 characters.
> - Publish after our own save succeeds, and never fail the user's action if Hypha is down.
>
> Secrets I will provide: `HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG`, `HYPHA_SPACE_API_KEY`.
>
> When done, walk me through the Definition of done checklist in §11.
