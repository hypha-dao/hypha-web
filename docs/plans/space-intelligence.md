# Space Intelligence & Documentation — Spec

> **Status:** Frozen for Phase B. **M1–M9 done** on `feat/org-memory`.  
> **Supersedes (for intelligence scope):** informal plans in chat; complements [space-memory-panel.md](./space-memory-panel.md) and [documents-and-media-overview.md](../architecture/documents-and-media-overview.md).  
> **Related product docs:** Organizational Intelligence App Architecture (IBA ↔ Markdown MCP); Hypha Energy Org Memory Ontology (first pack).

---

## 1. Purpose

Split Space Memory into two surfaces and make **Markdown organizational intelligence** the portable interface between Hypha, Hypha AI, and external Intelligence Business Apps (IBAs / Lovable):

| Surface                 | Holds                                       | Storage                                                                                                  |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Space Intelligence**  | Curated Markdown artifacts (shared meaning) | Object storage (bucket), self-contained files                                                            |
| **Space Documentation** | Regular files (text, image, video, PDF, …)  | Existing: Matrix (chat media), UploadThing/CDN (intentional uploads), call/discussion artifacts as today |

**Design rule:** Keep operational data local to IBAs. Share meaning through organizational memory. Hypha does **not** store IBA databases or Markdown _bodies_ in Postgres.

```text
IBA local DB  →  promote insight  →  Markdown in bucket  ↔  MCP  ↔  Hypha UI / Hypha AI / other IBAs
```

---

## 2. Goals

1. Members see **Space Intelligence** (cards + type filters + graph) above **Space Documentation** (table, no preview).
2. Intelligence files are readable/writable via the **same core APIs** used by the web UI and MCP.
3. IBAs promote insights as Markdown without syncing app schemas to Hypha.
4. Signals can propose **versioned patches**; any space member can approve; prior versions remain readable.
5. Knowledge graph covers **Intelligence artifacts ↔ signals only** (not Documentation media).

---

## 3. Non-goals (this initiative)

- Postgres tables as the system of record for Markdown bodies or intelligence catalogues.
- Migrating Documentation onto Matrix (or off Matrix for chat media).
- Migrating existing `DocumentState.MEMORY` docs into Intelligence (they stay Documentation).
- Full Energy ontology (ART-01…19) in v1 — pack seeds only (eight starters).
- Typed relationship verbs beyond `related` / signal linkage (phase later).
- Steward-only or governance-proposal publish gates (any member may approve in MVP).
- External search engine (Typesense/etc.) — defer until volume requires it.
- Ecosystem/organization path nesting beyond `spaces/{spaceSlug}/` (optional later).

---

## 4. Locked decisions

| #                         | Decision                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| Body store                | Object storage (bucket); **no Postgres for markdown**                  |
| Discovery                 | Bucket **manifest** (+ prefix list fallback); not a Hypha DB catalogue |
| Approval UX               | Extend **Coherence Signal detail** with proposed memory change         |
| Who approves / publishes  | Any **space member** (MVP)                                             |
| IDs                       | **Slug-ids**; packs may alias (e.g. ART-\* → slug)                     |
| Versioning                | Immutable versions + `supersedes` + content SHA-256 concurrency        |
| Existing MEMORY documents | Remain **Documentation**                                               |
| Documentation storage     | Matrix = chat-originated media; UploadThing/CDN = intentional uploads  |
| Graph                     | Intelligence ↔ signals only                                            |
| MCP                       | Same core server APIs as UI; path + app identity constraints           |
| Schema                    | Platform **core** frontmatter + **pack-specific** templates            |

---

## 5. Storage layout

### 5.1 Bucket product

- Dedicated **intelligence** object store (Vercel Blob or S3-compatible), server credentials only behind core/MCP.
- **Not** the same public CDN path used for casual Documentation uploads.
- UploadThing remains for Documentation; Intelligence writes go through core/MCP only.

### 5.2 Key layout (MVP)

```text
intelligence/
  spaces/{spaceSlug}/
    context/
    signals/
    assessments/
    insights/
    recommendations/
    proposals/
    decisions/
    _manifest.json
    _versions/{artifactId}/{sha}.md
  frameworks/{packId}/
    …templates and pack ontology…
```

Stable "current" object key per artifact (e.g. `…/assessments/{id}.md`) plus immutable `_versions/…`. Optional later: `ecosystems/{id}/organizations/{id}/spaces/{slug}/…`.

**Framework pack storage and authorization (before M7):**

- `frameworks/{packId}/` contains **globally readable, read-only** pack template files and ontology definitions.
- Packs are **not** copied into individual `spaces/{spaceSlug}/` paths; enabling a pack for a space grants members read access to `intelligence/frameworks/{packId}/**` and seeds template-based starter artifacts into the space's own prefix.
- Pack templates are authored and published by platform maintainers or trusted pack publishers; space members have **read-only** access via MCP path grants (`intelligence/frameworks/{packId}/**` in addition to `intelligence/spaces/{spaceSlug}/**`).
- Space frontmatter **must** declare enabled packs (e.g., `enabled_packs: [hypha-energy]`); seeding logic reads templates from `frameworks/{packId}/` and writes instantiated artifacts to `spaces/{spaceSlug}/{type}/{id}.md` with `source_app: pack-seed` or similar provenance.

### 5.3 Manifest (`_manifest.json`)

Bucket-side index updated on create / publish / archive. Enough for cards, filters, graph edges, and MCP `list`/`search` without Postgres.

Each entry (illustrative):

```json
{
  "id": "stakeholder-assessment-belica-2026-07",
  "type": "assessment",
  "title": "Stakeholder Assessment — Belica 5.0",
  "space": "belica-5-0",
  "status": "current",
  "tags": ["stakeholders", "governance"],
  "related": ["case-study-belica", "layer-assessment-belica"],
  "source_app": "stakeholder-protocol",
  "path": "intelligence/spaces/belica-5-0/assessments/stakeholder-assessment-belica-2026-07.md",
  "sha": "…",
  "version": 3,
  "updated_at": "2026-07-18"
}
```

**Atomicity and recovery protocol (before M1):**

Write order and semantics:

1. **Object write:** Upload the new/updated `.md` file to its stable or versioned path. Use bucket provider's idempotent write (PUT with same content overwrites safely).
2. **Manifest update:** Read current `_manifest.json`, apply the update (add/update/remove entry), write back atomically using conditional write semantics where available (e.g., S3 `If-Match` with ETag, or optimistic version field).
3. **Retry behavior:** On network/timeout failure between object and manifest write, retry the full operation idempotently. If the object exists with the expected SHA, skip re-upload; always attempt manifest reconciliation.

Crash recovery and reconciliation:

- **Unlisted immutable versions:** If `_versions/{artifactId}/{sha}.md` exists but is not referenced by any manifest entry, treat it as an orphaned backup; periodic repair jobs may list and index or prune based on age.
- **Missing current object:** If a manifest entry points to a `path` that does not exist in the bucket, list/search operations **skip** that entry (log warning); repair jobs should either restore from `_versions/` or remove the stale manifest entry.
- **Concurrency conflicts:** Manifest updates use read-modify-write with optimistic locking (retry loop on conflict); object writes are last-write-wins per key, protected by SHA validation at the application layer.

Cards and list/search operations rely on the manifest; if the manifest is inconsistent, the UI gracefully degrades (shows entries it can resolve) and logs diagnostics for operator review.

---

## 6. Markdown contract

### 6.1 Core frontmatter (required)

```yaml
---
id: stakeholder-assessment-belica-2026-07
type: assessment
title: Stakeholder Assessment — Belica 5.0
space: belica-5-0
source_app: stakeholder-protocol
status: current
created_at: 2026-07-18
updated_at: 2026-07-18
tags:
  - stakeholders
  - governance
  - strategic-risk
related:
  - case-study-belica
  - layer-assessment-belica
version: 3
supersedes: stakeholder-assessment-belica-2026-07-v2
---
```

**Note on immutability:** The `status` field records the state at version creation time. The manifest is the authoritative source for current/superseded determination; once written, the stored `.md` file is never modified. When version 3 above was published, the manifest entry for the predecessor (`stakeholder-assessment-belica-2026-07-v2`) was updated to `"status": "superseded"` without rewriting that version's stored file.

### 6.2 Core `type` vocabulary

`context` · `signal` · `assessment` · `insight` · `recommendation` · `decision` · `proposal` · `report` · `framework`

Packs may extend types; unknown pack types are allowed if declared by an enabled pack, but core tools must always understand the vocabulary above.

### 6.3 Status vocabulary

`draft` · `current` · `contested` · `superseded` · `archived`

### 6.4 Packs

- **Core** = platform-stable fields above.
- **Pack** (e.g. `frameworks/hypha-energy/`) = templates + optional extra frontmatter (`community_id`, `maturity`, `confidence`, `linked_signals`, …).
- First pack seed: Energy ontology **minimum viable eight** artifacts (Identity & Strategic Intent; Community Energy Profile; Stakeholder Map; Anchor & Site Pipeline; Project Portfolio; Governance Charter; Risk Register; Signal Inbox / Decision Log) — as templates, not auto-filled production data.

### 6.5 Graph edge contract

- **Graph edges:** Rendered from `linked_signals` (pack field linking Intelligence artifacts to signal IDs) only. The knowledge graph shows **Intelligence artifacts ↔ signals** relationships exclusively.
- **`related` field:** Used for semantic cross-references and manifest indexing; may reference other Intelligence artifact IDs or Documentation asset IDs. `related` edges are **not** rendered in the M3 graph visualization.
- Packs may use `linked_signals` (array of signal IDs) to declare which signals informed an artifact; graph construction reads this field plus reverse lookups from signals proposing patches to artifacts.

### 6.6 Content SHA contract

**Algorithm:** SHA-256, hex-encoded (64 lowercase characters).

**Input:** Complete stored Markdown object as UTF-8 bytes, including YAML frontmatter delimiters (`---`), frontmatter body, and Markdown content body. No normalization of newlines or whitespace beyond what the editor/client writes to storage.

**Responsibility:**

- UI, MCP, and IBA clients **must** compute the SHA from the identical byte sequence returned by bucket read operations.
- Server write operations (create/update) **must** return the resulting SHA in the response and persist it in `_manifest.json` and the frontmatter `sha` field (if stored).
- Optimistic concurrency: update requests **must** include the client's known SHA; the server rejects writes if the current object SHA does not match the supplied base SHA.

**Manifest and API consistency:** The `sha` value in manifest entries and `related` cross-reference sections (when enhanced with metadata) **must** match the SHA returned by reading the corresponding object.

---

## 7. Signals ↔ Intelligence (versioned patches)

```text
Incoming signal (Coherence / IBA / AI)
  → classify + link related artifact ids
  → ArtifactPatch (diff + provenance + expected base SHA)
  → member approval on Signal detail
  → publish new immutable version in bucket
  → update manifest; prior version status → superseded
```

**Immutable versioning model:**

- Each published version is written once and **never rewritten**. Frontmatter fields (`status`, `version`, etc.) in stored `.md` files reflect the state at creation time.
- The `supersedes` field in a new version points immutably to the predecessor artifact ID (or `null` for initial versions).
- **Current vs superseded determination:** Derived from manifest state. When a new version is published, the manifest entry for the prior version is updated to `"status": "superseded"` (or removed if only current versions are indexed), and the new version's entry is added with `"status": "current"`. The stored `.md` files themselves are not modified.
- **Alternative model (not implemented in MVP):** An immutable `successor` field could be added to the prior version's stored frontmatter during publish; however, this conflicts with immutability unless versions are always stored separately in `_versions/` and the stable path object is ephemeral. For M1–M3, the manifest is the authoritative source of current/superseded status.

Process:

- AI / IBAs **propose** patches; they do not silently overwrite `status: current` without approval rules.
- Human create/edit in Space Intelligence: members may publish directly in MVP, still **versioned** + SHA-checked.
- Optimistic concurrency: updates require the client's known content SHA.

---

## 8. UI

### 8.1 Memory tab structure

1. **Space Intelligence** (top) — Markdown cards; filter by `type` (and tags/status as needed); embedded knowledge graph.
2. **Space Documentation** (below) — table rows, no preview; sources unchanged (proposals, chat, calls, existing MEMORY docs, …). Secondary source chips optional inside Documentation.

### 8.2 Intelligence authoring

- Markdown body via existing TipTap editor.
- Frontmatter via structured fields and/or editable YAML; validate core schema on save.

### 8.3 Approval

- Coherence **Signal detail**: panel showing proposed patch (target id, diff, base SHA), actions Approve / Reject / Edit-then-approve.

---

## 9. APIs & MCP

### 9.1 Principle

MCP tools call the **same `@hypha-platform/core` server functions** as HTTP/UI. No parallel memory world.

### 9.2 Intelligence tools (names illustrative)

| Tool            | Behavior                                                        |
| --------------- | --------------------------------------------------------------- |
| `memory.search` | Search within allowed prefix; filter type/tags/status/space     |
| `memory.list`   | List from manifest (fallback: prefix list + frontmatter)        |
| `memory.read`   | Frontmatter + body (or excerpt)                                 |
| `memory.create` | Create draft or member-publish; enforce path + `.md`            |
| `memory.update` | SHA-checked; apps/AI default to **propose**; version on publish |
| `memory.delete` | Soft → `archived` / superseded; hard delete rare                |

Hypha AI chat uses the same core APIs as MCP, registered as `memory_list` / `memory_search` / `memory_read` / `memory_create` / `memory_update` / `memory_delete` / `memory_enable_pack` (underscores; OpenAI-style tool names). `source_app` is stamped `hypha-ai`.

### 9.3 Constraints (every call)

**Security-critical order:**

1. **Path canonicalization and traversal rejection (BEFORE prefix validation):**

   - Server **must** canonicalize all caller-supplied paths (resolve `.`, `..`, symbolic links, redundant slashes) and reject any path that after canonicalization would escape the `intelligence/` root or cross space boundaries.
   - Reject paths containing `..`, absolute paths outside the intelligence prefix, or encoded traversal attempts (e.g., `%2e%2e`, URL-encoded slashes).
   - Only after canonicalization and traversal rejection, validate that the resolved path matches permitted prefixes.

2. **Authenticated user (Privy):** All requests must carry valid session or MCP auth token.

3. **Authorized Space (membership):** User must be a member of the target space; `{slug}` in the path is validated against the user's memberships.

4. **Permitted path prefixes:** After canonicalization, enforce allowed patterns:

   - Space artifacts: `intelligence/spaces/{slug}/**` where `{slug}` matches the authenticated user's authorized space.
   - Framework packs (read-only): `intelligence/frameworks/{packId}/**` if the space has enabled that pack.

5. **Allowed file type:** `.md` only for Intelligence `memory.*` tools; reject other extensions.

6. **`source_app` validation (writes only):**

   - Derive `source_app` from the authenticated installation ID or launch ticket (IBA architecture contract).
   - **Reject** caller-supplied `source_app` values that do not match the authenticated app identity; server assigns the canonical value based on the request's auth context.

7. **Frontmatter validation (writes only):**

   - Server validates that `space`, `type`, and `id` in frontmatter match the request path and authorized scope.
   - Reject frontmatter values that conflict with server-derived constraints (e.g., `space` field does not match the `{slug}` in the path).

8. **Size and rate limits:** Enforce per-user, per-space, and per-app quotas.

### 9.4 Documentation tools

Existing `get_org_memory_by_space_slug` / `fetch_org_memory_asset` (and HTTP equivalents) remain for Documentation. Do not force media through `memory.*`.

### 9.5 IBA access

IBAs never receive bucket/GitHub credentials. They use Hypha MCP (+ launch-ticket auth as described in the IBA architecture). Path grants look like `intelligence/spaces/{slug}/**` and optionally `intelligence/frameworks/{packId}/**`.

---

## 10. Delivery slices

| Slice  | Scope                                                                                        | Exit criteria                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1** | Bucket layout, core frontmatter validation, manifest, Intelligence **read/list** cards in UI | Member can open Memory and see Intelligence cards from seeded/sample files                                                                          |
| **M2** | Member create/update/version; Documentation section = current aggregation as **table**       | Round-trip create → version → list; Documentation table shows existing assets without preview                                                       |
| **M3** | Graph from `linked_signals` (pack field; intelligence ↔ signals only)                        | Graph renders linked artifacts/signals for a space with sample edges                                                                                |
| **M4** | MCP `list` / `search` / `read`                                                               | External client with space auth can list/read same files as UI — **done** (`memory.list` / `memory.search` / `memory.read`)                         |
| **M5** | Signal detail approval → apply versioned patch                                               | Approve publishes new version; reject leaves current unchanged — **done** (blob `_patches/` + Signal detail panel)                                  |
| **M6** | MCP `create` / `update` / `delete` (propose or member-publish); app identity                 | IBA-shaped client can propose/update under path allowlist — **done** (`memory.create` / `memory.update` / `memory.delete` + `HYPHA_MCP_SOURCE_APP`) |
| **M7** | Energy pack templates (8 starters) under `frameworks/hypha-energy/`                          | Enabling pack seeds template files for a space — **done** (`hypha-energy` ART-01…08 + `memory.enable_pack`)                                         |
| **M8** | Graph from `linked_signals` + pending patches (intelligence ↔ signals only)                  | Graph shows artifact–signal edges; `related` is not rendered — **done**                                                                             |
| **M9** | Hypha AI uses Space Intelligence (`memory_*` chat tools + prompt)                            | Advisor creates/patches Intelligence artifacts from signals instead of opening a second Coherence signal — **done**                                 |

**Phase B kickoff:** implement **M1 → M3** first; freeze further slices only after M3 demo.

---

## 11. Acceptance criteria (initiative)

- [ ] Memory tab shows **Space Intelligence** above **Space Documentation**.
- [ ] Intelligence artifacts are `.md` files in the intelligence bucket with valid core frontmatter; bodies are **not** stored in Postgres.
- [ ] Manifest (or equivalent bucket index) drives card list/filter by `type`.
- [ ] Documentation lists non-intelligence assets as table rows without preview; Matrix/UploadThing behavior unchanged; existing MEMORY docs remain Documentation.
- [ ] Versions are immutable; stored `.md` files are never rewritten; publish creates new version with `supersedes` field; manifest determines current/superseded status; conflict on SHA mismatch.
- [x] Graph shows only intelligence ↔ signal relationships.
- [ ] Signal detail can approve a proposed patch that publishes a new version.
- [ ] Any space member can approve (MVP).
- [ ] MCP `memory.*` uses the same core APIs as the UI and enforces auth, space, path, `.md`, and `source_app`.
- [x] Hypha AI can list/read Intelligence and create or propose patches from a Coherence signal without opening a second signal.
- [ ] IBA can promote an insight without Hypha knowing its DB schema.

---

## 12. Risks & mitigations

| Risk                                      | Mitigation                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Manifest drift vs objects                 | Atomicity protocol (§5.3): object write → manifest update with retry; reconciliation for orphaned versions and missing objects |
| Large spaces / slow list                  | Manifest first; external search only if needed                                                                                 |
| Silent overwrites by two AIs              | Require content SHA; prefer propose → approve for app/AI writers                                                               |
| Confusing Intelligence vs Documentation   | Distinct UI sections + copy; MEMORY docs explicitly Documentation                                                              |
| Bucket vs GitHub expectations in IBA docs | Bucket is Hypha SOFT; MCP hides backend; SHA concurrency mirrors Git semantics                                                 |

---

## 13. Open items (non-blocking for M1)

1. ~~Exact Blob vs S3 vendor choice and env var names.~~ → **Vercel Blob** via `BLOB_READ_WRITE_TOKEN` (private access).
2. Manifest format: JSON vs Markdown registry file (JSON preferred for MCP).
3. Whether human direct edits skip the Signal approval panel (spec allows direct member publish; signal flow still required for AI/IBA proposals).
4. GitHub issue / project board card for tracking (create when ready).

---

## 14. References

- [space-memory-panel.md](./space-memory-panel.md) — existing panel / org-memory aggregation
- [documents-and-media-overview.md](../architecture/documents-and-media-overview.md) — Matrix vs upload backends
- Organizational Intelligence App Architecture — IBA local DB + Markdown MCP boundary
- Hypha Energy Org Memory Ontology — first pack vocabulary and MVP artifact set
