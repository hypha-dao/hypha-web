# Space Intelligence & Documentation — Spec

> **Status:** Frozen for Phase B (M1–M3 first). Branch: `feat/org-memory`.  
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
| Versioning                | Immutable versions + `supersedes` + content SHA concurrency            |
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

Stable “current” object key per artifact (e.g. `…/assessments/{id}.md`) plus immutable `_versions/…`. Optional later: `ecosystems/{id}/organizations/{id}/spaces/{slug}/…`.

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
supersedes: null
---
```

### 6.2 Core `type` vocabulary

`context` · `signal` · `assessment` · `insight` · `recommendation` · `decision` · `proposal` · `report` · `framework`

Packs may extend types; unknown pack types are allowed if declared by an enabled pack, but core tools must always understand the vocabulary above.

### 6.3 Status vocabulary

`draft` · `current` · `contested` · `superseded` · `archived`

### 6.4 Packs

- **Core** = platform-stable fields above.
- **Pack** (e.g. `frameworks/hypha-energy/`) = templates + optional extra frontmatter (`community_id`, `maturity`, `confidence`, `linked_signals`, …).
- First pack seed: Energy ontology **minimum viable eight** artifacts (Identity & Strategic Intent; Community Energy Profile; Stakeholder Map; Anchor & Site Pipeline; Project Portfolio; Governance Charter; Risk Register; Signal Inbox / Decision Log) — as templates, not auto-filled production data.

---

## 7. Signals ↔ Intelligence (versioned patches)

```text
Incoming signal (Coherence / IBA / AI)
  → classify + link related artifact ids
  → ArtifactPatch (diff + provenance + expected base SHA)
  → member approval on Signal detail
  → publish new immutable version in bucket
  → update manifest; prior version → superseded
```

- AI / IBAs **propose**; they do not silently overwrite `status: current` without approval rules.
- Human create/edit in Space Intelligence: members may publish directly in MVP, still **versioned** + SHA-checked.
- Optimistic concurrency: updates require the client’s known content SHA.

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

### 9.3 Constraints (every call)

- Authenticated user (Privy)
- Authorized Space (membership)
- Permitted path (`intelligence/spaces/{slug}/**`, optional `intelligence/frameworks/{pack}/**`)
- Allowed file type (`.md` only for these tools)
- Installation / app identity (`source_app`) on writes
- Size and rate limits

### 9.4 Documentation tools

Existing `get_org_memory_by_space_slug` / `fetch_org_memory_asset` (and HTTP equivalents) remain for Documentation. Do not force media through `memory.*`.

### 9.5 IBA access

IBAs never receive bucket/GitHub credentials. They use Hypha MCP (+ launch-ticket auth as described in the IBA architecture). Path grants look like `intelligence/spaces/{slug}/**` and optionally `intelligence/frameworks/{packId}/**`.

---

## 10. Delivery slices

| Slice  | Scope                                                                                        | Exit criteria                                                                                 |
| ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **M1** | Bucket layout, core frontmatter validation, manifest, Intelligence **read/list** cards in UI | Member can open Memory and see Intelligence cards from seeded/sample files                    |
| **M2** | Member create/update/version; Documentation section = current aggregation as **table**       | Round-trip create → version → list; Documentation table shows existing assets without preview |
| **M3** | Graph from `related` + signal links (intelligence ↔ signals only)                            | Graph renders linked artifacts/signals for a space with sample edges                          |
| **M4** | MCP `list` / `search` / `read`                                                               | External client with space auth can list/read same files as UI                                |
| **M5** | Signal detail approval → apply versioned patch                                               | Approve publishes new version; reject leaves current unchanged                                |
| **M6** | MCP `create` / `update` / `delete` (propose or member-publish); app identity                 | IBA-shaped client can propose/update under path allowlist                                     |
| **M7** | Energy pack templates (8 starters) under `frameworks/hypha-energy/`                          | Enabling pack seeds template files for a space                                                |

**Phase B kickoff:** implement **M1 → M3** first; freeze further slices only after M3 demo.

---

## 11. Acceptance criteria (initiative)

- [ ] Memory tab shows **Space Intelligence** above **Space Documentation**.
- [ ] Intelligence artifacts are `.md` files in the intelligence bucket with valid core frontmatter; bodies are **not** stored in Postgres.
- [ ] Manifest (or equivalent bucket index) drives card list/filter by `type`.
- [ ] Documentation lists non-intelligence assets as table rows without preview; Matrix/UploadThing behavior unchanged; existing MEMORY docs remain Documentation.
- [ ] Versions are immutable; publish updates current pointer + `supersedes`; conflict on SHA mismatch.
- [ ] Graph shows only intelligence ↔ signal relationships.
- [ ] Signal detail can approve a proposed patch that publishes a new version.
- [ ] Any space member can approve (MVP).
- [ ] MCP `memory.*` uses the same core APIs as the UI and enforces auth, space, path, `.md`, and `source_app`.
- [ ] IBA can promote an insight without Hypha knowing its DB schema.

---

## 12. Risks & mitigations

| Risk                                      | Mitigation                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Manifest drift vs objects                 | Write path updates manifest in the same server transaction/order; repair job later if needed |
| Large spaces / slow list                  | Manifest first; external search only if needed                                               |
| Silent overwrites by two AIs              | Require content SHA; prefer propose → approve for app/AI writers                             |
| Confusing Intelligence vs Documentation   | Distinct UI sections + copy; MEMORY docs explicitly Documentation                            |
| Bucket vs GitHub expectations in IBA docs | Bucket is Hypha SOFT; MCP hides backend; SHA concurrency mirrors Git semantics               |

---

## 13. Open items (non-blocking for M1)

1. Exact Blob vs S3 vendor choice and env var names.
2. Manifest format: JSON vs Markdown registry file (JSON preferred for MCP).
3. Whether human direct edits skip the Signal approval panel (spec allows direct member publish; signal flow still required for AI/IBA proposals).
4. GitHub issue / project board card for tracking (create when ready).

---

## 14. References

- [space-memory-panel.md](./space-memory-panel.md) — existing panel / org-memory aggregation
- [documents-and-media-overview.md](../architecture/documents-and-media-overview.md) — Matrix vs upload backends
- Organizational Intelligence App Architecture — IBA local DB + Markdown MCP boundary
- Hypha Energy Org Memory Ontology — first pack vocabulary and MVP artifact set
