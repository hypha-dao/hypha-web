# Intelligence Business Apps (IBA) — Spec

> **Status:** Frozen for Phase B on **`feat/business-app`**.  
> **Depends on:** [space-intelligence.md](./space-intelligence.md) (`feat/org-memory`, M1–M9).  
> **Complements:** [external-signal-ingestion.md](../integrations/external-signal-ingestion.md) and the Lovable-facing Signals spec at `apps/web/src/app/api/v1/spaces/[spaceSlug]/signals/README.md`.  
> **Does not implement:** full IBA catalog, OAuth for MCP hosts, or short-lived launch-ticket JWTs (deferred; see §12).

---

## 1. Purpose

Let an **Intelligence Business App** (IBA) — typically a Lovable (or similar) app with its own database — **query and promote meaning** into a Hypha space’s **Space Intelligence**, without receiving bucket credentials and without syncing its schema to Hypha.

Canonical example:

```text
Team builds a Lovable stakeholder-analysis app
  → operational rows stay in the IBA database
  → the app promotes a Markdown assessment into the space’s org memory
  → Hypha UI / Hypha AI / other IBAs read the same artifact
```

```text
IBA local DB  →  promote insight  →  Markdown in intelligence bucket
                                      ↑
                         REST (API key)  and/or  hosted MCP (same key)
```

This initiative closes the gap left by `feat/org-memory`: the **data plane** (blob, manifest, `memory.*` tools, member HTTP) exists; the **external install path** does not. MCP today is **stdio + process env** (`HYPHA_MCP_AUTH_TOKEN`, `HYPHA_MCP_SOURCE_APP`). Lovable cannot attach to that, and env identity is one slug per process, not per install.

---

## 2. Goals

1. A space-scoped integration credential can **read and write Space Intelligence** for that space only.
2. IBAs never receive `BLOB_READ_WRITE_TOKEN`, GitHub tokens, or other storage credentials.
3. `source_app` is **server-assigned** from the authenticated install (`space_api_keys.source`), never trusted from the client.
4. Running Lovable apps can CRUD via **HTTP REST** (same pattern as Signals).
5. MCP hosts that speak **Streamable HTTP** can call the existing `memory.*` tools against a **public Hypha URL**, authenticated per request.
6. IBA writes default to **draft** / **propose**; they must not silently overwrite `status: current` without the existing member-approval rules.
7. A Lovable-ready **agent spec** exists so an AI coding agent can implement the IBA side without reading this repo.

---

## 3. Non-goals (this branch)

- Changing the Markdown contract, bucket layout, or member UI from [space-intelligence.md](./space-intelligence.md).
- Giving IBAs Documentation / Matrix / UploadThing write access (`memory.*` stays Intelligence `.md` only).
- Full launch-ticket JWT, IBA marketplace, or per-install OAuth (MCP Authorization spec). Space API keys **are** the MVP launch ticket.
- Hosted MCP OAuth for Claude.ai / ChatGPT / Cursor cloud (API key bearer is enough for Lovable backends).
- Enabling framework packs from an IBA (`memory.enable_pack` stays a member/Hypha-AI action).
- Expanding an intelligence key into treasury, roster, or governance tools.
- Per-app rate-limit product (reuse existing size caps; quotas later).
- Browser-side keys. Keys remain **server-side secrets** (Lovable Cloud / Edge Function), same rule as Signals.

---

## 4. Locked decisions

| # | Decision |
|---|---|
| Credential | Reuse **`space_api_keys`**. Do not add a second credential table in MVP. |
| Launch ticket (MVP) | The issued key **is** the install identity: `source` → `source_app`, `space_id` → path grant. |
| Auth header | `x-hypha-api-key: hyk_…` or `Authorization: Bearer hyk_…` (already implemented for Signals). |
| Scopes | Add `intelligence:read` and `intelligence:write`. Existing `signals:*` scopes unchanged. |
| Membership gate | IBA calls **do not** use `checkSpaceAccessForSpace` (Privy membership). A key is a per-space grant, including on public spaces — same as Signals ingestion. |
| Path grant | `intelligence/spaces/{slug}/**` for the key’s space only. Pack templates `intelligence/frameworks/{packId}/**` are **read-only** if that pack is enabled on the space. |
| `source_app` | Always `space_api_keys.source`. Reject caller-supplied values that differ. |
| Write semantics | `intelligence:write` may **create draft**, **propose** a patch (needs `signal_slug`), and **soft-archive**. **Publish / promote to `current`** remains a space member (Privy) action. |
| REST vs MCP | REST unblocks running Lovable apps. Hosted MCP unblocks MCP hosts. Same core functions; no parallel store. |
| MCP transport | Add **Streamable HTTP** next to existing **stdio**. Stdio keeps env fallback for local Cursor. |
| MCP tool allowlist | Intelligence keys expose **`memory.list` / `search` / `read` / `create` / `update` / `delete` only**. Not the full Hypha MCP inventory. |
| Hosting | HTTP MCP lives on the **web app** (`apps/web` route), so it shares blob/DB env with intelligence APIs. Not a second deployable in MVP. |
| Ops issuance | Keys still issued via existing ops route (`x-hypha-ops-secret`). Not from the public space UI. |
| Docs | IBA-facing spec next to Signals: `apps/web/src/app/api/v1/spaces/[spaceSlug]/intelligence/README.md`. |

---

## 5. Current state (do not regress)

Already on `feat/org-memory`:

| Surface | What exists | Gap |
|---|---|---|
| Core | `list` / `read` / `write` / `delete` / pack enable; SHA; path checks | Write path assumes Privy `authToken` + membership |
| HTTP | `GET/POST …/intelligence`, `GET/DELETE …/intelligence/{id}` | No `x-hypha-api-key`; `source_app` is caller-supplied |
| MCP stdio | `memory.*` tools | `StdioServerTransport`; identity from process env |
| Hypha AI | `memory_*` chat tools, `source_app: hypha-ai` | In-app only |
| Signals IBA | Space API keys, scopes, Lovable README | Intelligence scopes not defined |

---

## 6. Auth and identity

### 6.1 Two caller kinds

| Kind | Credential | Space access | `source_app` |
|---|---|---|---|
| **Member** | Privy JWT (`Authorization: Bearer`) | `checkSpaceAccessForSpace` | `hypha` (HTTP UI) or `hypha-ai` / `hypha-mcp` |
| **IBA** | Space API key | Key’s `spaceId` only | Key’s `source` |

A request is IBA if a valid space API key is presented. Do not require a Privy JWT in addition.

### 6.2 New scopes

```ts
'intelligence:read'   // list, search, read
'intelligence:write'  // create draft, propose update, soft-archive
```

`intelligence:write` **implies** read for that key (or require both scopes at issuance — pick one in implementation and document it in the IBA README). **Locked:** write implies read, so one scope list `["intelligence:write"]` is enough for a CRUD IBA.

Ops create body already accepts `scopes: string[]` validated against `SPACE_API_KEY_SCOPES`. Extend that enum; no migration of existing signal keys.

### 6.3 Path and slug binding

After path canonicalization ([space-intelligence.md](./space-intelligence.md) §9.3):

1. Resolve space from the URL / tool `space_slug`.
2. Authenticate key against **that** `spaceId`.
3. Reject tool args or frontmatter `space` that do not match the key’s space.
4. Reject paths outside `intelligence/spaces/{slug}/` (except read of enabled pack frameworks).

### 6.4 Core write plumbing

`writeIntelligenceBySpaceSlug` / `deleteIntelligenceBySpaceSlug` / list+read must accept an **IBA context**:

```ts
{
  kind: 'iba';
  spaceId: number;
  source_app: string; // key.source
  scopes: ('intelligence:read' | 'intelligence:write')[];
}
```

When `kind === 'iba'`:

- Skip membership check.
- Stamp `canonicalSourceApp` from context.
- Force create `status: draft` unless a future spec opens IBA publish.
- Update default remains **propose** (signal approval). Direct `mode=publish` on an IBA credential returns **403**.

Stdio MCP may keep env identity for **member-shaped** local use. Hosted MCP **must not** read `HYPHA_MCP_AUTH_TOKEN` / `HYPHA_MCP_SOURCE_APP` as the IBA identity.

---

## 7. HTTP contract (running Lovable app)

Base: `{HYPHA_BASE_URL}/api/v1/spaces/{HYPHA_SPACE_SLUG}/intelligence`

All IBA calls send the key. JSON only. Unrecognised fields on write bodies fail with `400` (mirror Signals strictness).

| Method | Path | Scope | Behavior |
|---|---|---|---|
| `GET` | `/intelligence` | read | List/search (existing query params: `type`, `status`, `search` / `q`) |
| `GET` | `/intelligence/{artifactId}` | read | Frontmatter + body + `sha` |
| `POST` | `/intelligence` | write | Create **draft** (IBA) or member publish (Privy) |
| `POST` | `/intelligence/{artifactId}` or existing POST-update | write | SHA-checked update: IBA **propose** only |
| `DELETE` | `/intelligence/{artifactId}?expectedSha=` | write | Soft archive |

**IBA POST create** (illustrative):

```http
POST /api/v1/spaces/belica-5-0/intelligence
x-hypha-api-key: hyk_…
Content-Type: application/json
```

```json
{
  "title": "Stakeholder Assessment — Belica 5.0",
  "type": "assessment",
  "body": "## Allies\n\n- …",
  "tags": ["stakeholders", "governance"],
  "related": ["energy-stakeholder-map"],
  "linked_signals": []
}
```

Server fills `id` (slug-id), `space`, `source_app`, `status: draft`, dates, `version`. Do **not** require the IBA to send YAML; accepting structured fields (like Hypha AI `memory_create`) is preferred so Lovable agents do not invent frontmatter.

Also accept full `markdown` for power users; if both are sent, structured fields win for identity (`space`, `source_app`, `status`) and markdown body is the content.

**Concurrency:** updates and deletes require `expectedSha` (or `expected_sha`). Mismatch → `409` with `currentSha`.

**Idempotency (create):** optional `externalId` (IBA’s own row id) is **out of scope for MVP** unless cheap to add as frontmatter `external_id`. Do not block B1 on it; Signals already have `externalId` for coherences. Note as open item.

---

## 8. Hosted MCP

### 8.1 Endpoint

```text
POST https://{hypha-host}/api/mcp
```

MCP **Streamable HTTP** (current spec). Stateless preferred (one POST per message, no sticky SSE).

- Health: `GET /api/mcp` → `200` with protocol/name/version (non-secret).
- CORS: not required for Lovable Edge Functions; do not enable `*` with credentialed cookies.

### 8.2 Session identity

On each request:

1. Parse API key from headers (same helpers as Signals).
2. If key present → IBA context; tool allowlist from scopes.
3. Else if Privy Bearer → existing member MCP behavior (optional on this route; **locked:** hosted `/api/mcp` is **IBA-only** in MVP to avoid mixing session cookies with a public endpoint). Local stdio remains the member/Cursor path.

### 8.3 Tools (IBA allowlist)

Same names and schemas as `packages/mcp-server` `memory.*`:

| Tool | Scope |
|---|---|
| `memory.list` | read |
| `memory.search` | read |
| `memory.read` | read |
| `memory.create` | write — force draft |
| `memory.update` | write — default propose; reject publish |
| `memory.delete` | write — soft archive |

`space_slug` in arguments **must** match the key’s space (or may be omitted and inferred — infer if omitted).

Do not register `memory.enable_pack`, roster, treasury, or signal-create on this hosted endpoint.

### 8.4 Implementation sketch

- Extract shared tool handlers from `packages/mcp-server/src/main.ts` so stdio and HTTP do not drift.
- Web route constructs `McpServer`, uses Streamable HTTP transport from `@modelcontextprotocol/sdk`, passes request-scoped identity into handlers.
- `BLOB_READ_WRITE_TOKEN` and DB URLs stay server env.

---

## 9. Example: stakeholder analysis IBA

1. Ops issues a key for space `belica-5-0`:

   ```json
   {
     "name": "Stakeholder protocol",
     "source": "stakeholder-protocol",
     "scopes": ["intelligence:write"]
   }
   ```

2. Lovable stores `HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG`, `HYPHA_SPACE_API_KEY` as **Edge Function secrets**.

3. The app keeps interviews, scores, and PII in **its** DB.

4. On “Publish to org memory”, the Edge Function `POST`s an `assessment` (draft) titled e.g. `Stakeholder Assessment — Belica 5.0`. Optional `related: ["energy-stakeholder-map"]` if the Energy pack is enabled.

5. A space member reviews the draft in the Memory tab (or approves a proposed patch on a signal) and publishes.

6. Hypha AI and other IBAs `memory.read` the current assessment. They never see the Lovable database.

---

## 10. IBA agent spec (deliverable)

Add `apps/web/src/app/api/v1/spaces/[spaceSlug]/intelligence/README.md`, written for an AI coding agent building **the other app**, mirroring the Signals README:

Must include:

1. What you are building (promote Markdown meaning; local DB stays local).
2. Hard rules (server-side key, no `VITE_*`, never send YAML identity fields, never retry `4xx`, never block UX on Hypha downtime).
3. Secrets table (`HYPHA_BASE_URL`, `HYPHA_SPACE_SLUG`, `HYPHA_SPACE_API_KEY`).
4. REST examples for list / read / create draft / propose update / archive.
5. SHA concurrency.
6. Type vocabulary (`assessment`, `insight`, …) and the stakeholder example.
7. Explicit: this is **not** the Signals API; files vs board posts.

Human narrative: `docs/integrations/external-intelligence-ingestion.md` (short), linking the README.

---

## 11. Delivery slices

Branch **`feat/business-app`** off **`feat/org-memory`** (intelligence APIs are not on `main` until that merges). If `feat/org-memory` merges first, rebase onto `main`.

| Slice | Scope | Exit criteria |
|---|---|---|
| **B1** | Scopes `intelligence:read` / `intelligence:write`; IBA auth on existing intelligence HTTP; skip membership; stamp `source_app`; IBA create = draft; IBA update publish = 403 | Lovable-style curl with a space key lists/reads/creates a draft assessment and cannot publish |
| **B2** | Hosted Streamable HTTP MCP at `/api/mcp`; per-request key; `memory.*` allowlist; shared handlers with stdio | MCP Inspector or `curl` initialize + `memory.list` against a deployed/preview URL |
| **B3** | IBA README + `docs/integrations/external-intelligence-ingestion.md`; ops examples updated for new scopes | An AI agent can implement the Lovable Edge Function from the README alone |
| **B4** | Tests: key on wrong space; spoofed `source_app`; path traversal; propose vs publish; stdio MCP still works with env | Core + route tests green |

**Phase B kickoff:** implement **B1 first** (unblocks the running Lovable app). B2–B3 can proceed in parallel after B1 auth helpers exist.

---

## 12. Deferred (not this branch)

1. Short-lived launch-ticket JWTs (install row, `exp`, pack-specific prefixes).
2. MCP OAuth 2.1 for third-party agent hosts.
3. IBA `externalId` idempotency on artifacts.
4. IBA publish-to-current (if product later trusts some apps).
5. Space UI for issuing keys (still ops-only because spaces can be public).
6. Rate limits per key / per space.

---

## 13. Acceptance criteria

- [ ] A space API key with `intelligence:write` can create a **draft** assessment in `intelligence/spaces/{slug}/` via HTTP; blob token is never exposed.
- [ ] The same key **cannot** write another space, cannot set `source_app` to a different slug, and cannot `publish` to `current`.
- [ ] `GET` list/read with `intelligence:read` (or write-implies-read) returns the same manifest-backed artifacts as the Memory tab.
- [ ] Member Privy flows (UI, Hypha AI) keep working; signal keys without intelligence scopes still cannot touch intelligence.
- [ ] Hosted MCP at `/api/mcp` authenticates per request and exposes only `memory.*` for IBA keys.
- [ ] Stdio MCP remains usable locally (env fallback).
- [ ] Lovable-facing README exists and matches the implemented HTTP contract.
- [ ] Stakeholder-analysis example in the README produces a valid `type: assessment` draft.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Public `/api/mcp` plus a leaked key | Same as Signals: ops-only issuance, revoke, server-side storage in the IBA; no browser keys |
| IBA overwrites `current` | Force draft/propose on IBA credentials; 403 on publish |
| Tool surface too wide | Hosted MCP allowlist = `memory.*` only |
| Handler drift stdio vs HTTP | Shared module; B4 tests both |
| Confusing Signals vs Intelligence | Separate README; copy states Markdown org memory ≠ board posts |
| `feat/org-memory` not merged | Branch from it; rebase when it lands |

---

## 15. References

- [space-intelligence.md](./space-intelligence.md) — Markdown contract, MCP tool semantics, path rules
- [external-signal-ingestion.md](../integrations/external-signal-ingestion.md) — existing IBA key model
- `packages/mcp-server/README.md` — current stdio MCP
- `packages/core/src/space-api-key/` — authenticate, hash, scopes
- `packages/core/src/intelligence/app-identity.ts` — `resolveCanonicalSourceApp`
- Energy pack ART-03 `energy-stakeholder-map` — optional `related` target for the example
