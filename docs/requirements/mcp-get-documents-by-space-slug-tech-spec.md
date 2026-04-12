# Technical Specification — MCP tool `get_documents_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Implemented (see `packages/mcp-server` + `packages/core/src/governance/server/get-documents-by-space-slug.ts`) |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Scope** | Read-only MCP tool listing **documents** stored for a space (PostgreSQL `documents` table), with **creator resolution** (person or space creator), **pagination**, optional **full-text search**, optional **`state` filter**, and the **same non-public space access gating** as `get_people_by_space_slug`. Each row includes **`attachments`** and **`leadImage`** (upload / CDN URLs) so hosts can fetch binaries for summarisation. |
| **Parity** | Same pattern as **`get_people_by_space_slug`**: Zod `inputSchema` / `outputSchema`, `structuredContent`, `readOnlyHint` / `idempotentHint`, `HYPHA_MCP_AUTH_TOKEN` for `checkSpaceAccessForSpace` |

---

## 1) Problem statement

Assistants need a **typed, paginated** way to answer:

- “What **proposals / discussions / agreements** exist in this space?”
- “**Search** documents by keywords in title or description.”
- “Who **created** this document?” (resolved `creator` object on each row)
- “What **files** (PDFs, images, videos) are **attached** to proposals in this space?” (from `attachments` + `leadImage` on each document)

without scraping the UI or hallucinating content. This is **distinct** from the **member roster** (`get_people_by_space_slug`) and from **aggregate document counts** on `get_space_by_slug`.

**Org memory (cross-cutting):** Governance **documents** are one leg of [organisation memory §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work). **Matrix-only** chat attachments (`mxc://` on timeline events) are **not** in `documents` until a **catalogue** ingests them (same §4). This tool’s SQL contract stays **documents-first**; **unifying** upload + Matrix assets for MCP is specified in **§8** below and in [PR #2138](https://github.com/hypha-dao/hypha-web/pull/2138) / `docs/plans/space-memory-panel.md` §9.

---

## 2) Source of truth (data model)

### 2.1 Primary table: `documents`

Schema: `packages/storage-postgres/src/schema/document.ts`.

| Column (Drizzle / DB) | In tool output (JSON) |
|-----------------------|------------------------|
| `id`, `creatorId`, `spaceId` | `id`, `creatorId` (`spaceId` implied by query) |
| `title`, `description`, `state`, `slug`, `label` | Same names (camelCase) |
| `leadImage`, `attachments`, `web3ProposalId` | Same |
| `createdAt`, `updatedAt` | ISO-8601 **strings** |

**FR:** The tool SHALL return **every scalar field** on `Document` from `mapToDocument` in `@hypha-platform/core` governance types (`packages/core/src/governance/types.ts`), plus optional **`creator`** (avatar, name/surname or space title, type `person` \| `space`, address). That includes **`attachments`** (array of string URLs and/or `{ name, url }`) and **`leadImage`** so MCP clients and Hypha Chat can pass **HTTPS** links to **`web_fetch`**, multimodal inputs, or downstream indexers.

**FR-AI (informative):** The tool returns **metadata + URLs**, not raw file bytes. Whether the **host model** can “open” a PDF/image/video depends on URL reachability (public, signed, or session-gated) and host capabilities — see **§8.2**.

**Explicit boundary (today):** The implementation does **not** query a separate **org memory catalogue** table, coherence-only tables, token rows, or vote tallies. **Matrix chat-only** files that never appear on a `documents` row are **out of scope** for this tool **until** §8.1 delivers catalogue-backed fields or a sibling tool.

**Token / agreement side tables** remain out of scope unless a dedicated epic extends the contract.

### 2.2 Query implementation

Single entry point in core: **`getDocumentsBySpaceSlug`** (`packages/core/src/governance/server/get-documents-by-space-slug.ts`), which delegates listing to **`findAllDocumentsBySpaceSlug`** (`packages/core/src/governance/server/queries.ts`):

- `INNER JOIN spaces ON documents.space_id = spaces.id WHERE spaces.slug = :spaceSlug`
- Optional **`searchTerm`**: same `to_tsvector` / `plainto_tsquery` filter as the app list.
- Optional **`state`**: `discussion` \| `proposal` \| `agreement`.
- **Order:** `createdAt` **DESC** via explicit `order` passed from **`getDocumentsBySpaceSlug`** only. Shared **`findAllDocumentsBySpaceSlug`** does not apply implicit ordering when `order` is empty (caller-defined).

### 2.3 Access control

When the host space has **`web3SpaceId`**, call **`checkSpaceAccessForSpace(host, HYPHA_MCP_AUTH_TOKEN)`** before querying (same as roster tool). On denial, MCP returns **`isError: true`** with the access message as **text** content (no structured payload).

Spaces **without** `web3SpaceId` are treated as **open** for reads (same as roster).

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-1** | Expose MCP tool **`get_documents_by_space_slug`**. |
| **FR-2** | Read-only, idempotent; no writes. |
| **FR-3** | Inputs: **`space_slug`**, **`page`** (default 1), **`page_size`** (default 20, max 100), optional **`searchTerm`**, optional **`state`**. |
| **FR-4** | Output: **`found`**, **`space_slug`**, **`space`** (`id`, `slug`, `title`, `parent_id`) or **`null`** if not found, **`source: "db"`**, **`asOf`**, **`documents[]`**, **`pagination`** with snake_case keys matching roster style (`page_size`, `total_pages`, `has_next_page`, `has_previous_page`). |
| **FR-5** | Serialize all **`Date`** fields on documents as **ISO strings**. |
| **FR-6** | Invalid slug → validation error **before** DB (Zod; align with `get-people-by-space-slug-schema` slug rules). |
| **FR-7** | Unknown slug → **`found: false`**, empty `documents`, `space: null`, pagination zeros — not an MCP transport error. |
| **FR-8** | Each document in **`documents[]`** MUST expose **`attachments`** and **`leadImage`** exactly as stored (after JSON serialisation), so a client can enumerate **all upload-backed files** for the space across paginated calls. |

---

## 4) Contract (Zod + MCP registration)

### 4.1 Input schema

Implemented in `packages/mcp-server/src/get-documents-by-space-slug-schema.ts` (keep aligned with `spaceSlugSchema` in core).

### 4.2 Output schema

Structured content validated with **`getDocumentsBySpaceSlugOutputSchema`** — must stay in sync with **`GetDocumentsBySpaceSlugResult`** from core.

### 4.3 Registration

`server.registerTool(...)` next to `get_people_by_space_slug` in `packages/mcp-server/src/main.ts`.

---

## 5) Security & operations

- **`HYPHA_MCP_AUTH_TOKEN`**: Privy JWT for restricted spaces (documented in `packages/mcp-server/README.md`).
- **Rate limits**: inherits DB + app behaviour; no extra writes.

---

## 6) Testing checklist

| Test | Expected |
|------|----------|
| Public space, no token | Returns documents when slug exists |
| Restricted space, no token | Access error (text), `isError` |
| Restricted space, valid token | Paginated documents |
| Bad slug | Zod / MCP validation error |
| Unknown slug | `found: false` structured payload |
| `searchTerm` | Subset matches FTS behaviour of `findAllDocumentsBySpaceSlug` |

---

## 7) References

- Epic: [#2027](https://github.com/hypha-dao/hypha-web/issues/2027)
- Sibling spec: `mcp-get-people-by-space-slug-tech-spec.md`
- Org memory / catalogue architecture: [documents-and-media-overview.md §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work), [§4.7 MCP / Chat](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai)
- UI plan (Space Memory + MCP §9): [space-memory-panel.md](../plans/space-memory-panel.md)
- Matrix chat media (merged): [#2133](https://github.com/hypha-dao/hypha-web/pull/2133)
- Coherence / org memory docs PR: [#2138](https://github.com/hypha-dao/hypha-web/pull/2138)

---

## 8) Organisation memory — roadmap for “upload + Matrix” in MCP

This section is **normative for product direction** on PR [#2141](https://github.com/hypha-dao/hypha-web/pull/2141); **implementation** may land in follow-up PRs once the catalogue schema exists.

### 8.1 Unified listing (target)

| Milestone | MCP / Chat behaviour |
|-----------|----------------------|
| **Now (this PR)** | **`get_documents_by_space_slug`** returns **all `documents` rows** for the space; each row’s **`attachments`** + **`leadImage`** enumerate **every upload-backed file** already persisted on proposals / discussions / agreements (paginate until `has_next_page` is false to collect the full set). |
| **With org memory catalogue** (§4) | **Either** add an **additive** optional field on the same tool result, e.g. **`org_memory_assets`** (flattened rows: `source`, `filename`, `mime`, `app_url` \| `mxc_uri`, optional `matrix_room_id`, `matrix_event_id`, `document_id`, optional `fetch_url` / `text_excerpt`), **or** register a sibling read-only tool **`get_org_memory_by_space_slug`** with the same **`checkSpaceAccessForSpace`** gating. Prefer **additive JSON** if backward compatibility with existing MCP hosts is critical. |
| **Matrix-only files** | Require **catalogue ingestion** from Matrix timeline (`m.file` / `m.image`, §4.2). The MCP layer MUST NOT pretend `mxc://` URIs are SQL columns on `documents`. |

### 8.2 AI “opening” documents, images, and video

| URL type | Expected assistant behaviour |
|----------|-------------------------------|
| **Public or long-lived signed HTTPS** (typical CDN) | Host may **`web_fetch`** or attach as multimodal input; model can summarise **text** PDFs and describe **images** / **video** when the host supports those modalities. |
| **Session- or cookie-gated URLs** | `web_fetch` from the MCP host may **fail** anonymously. **Mitigation:** server-side authenticated fetch tool, **or** org memory **`indexed_text_ref`** / excerpts populated at ingestion time. |
| **`mxc://` (Matrix)** | Not in tool output until §8.1. When present, resolution MUST use a **server** Matrix access token (or a **minted short-lived HTTPS** URL), not browser-only `mxcUrlToHttp` assumptions — see `docs/architecture/space-chat-attachments.md` and Matrix role guidance. |

### 8.3 Matrix SDK / security notes (for implementers of §8.1)

- Use **real room IDs** (`!…:server`) for catalogue correlation, not aliases.
- **`matrix-js-sdk@^40`** in this monorepo for any server-side sync worker.
- **E2EE rooms:** org memory including encrypted attachments may require **client-assisted** registration (§4.6) — MCP must not leak media the user cannot decrypt.

---

## 9) Testing checklist (org memory–adjacent)

| Test | Expected |
|------|----------|
| Document with **3 attachments** | Tool returns all three URLs/names on that row across pagination |
| **Lead image only** | `leadImage` non-null, `attachments` empty or `[]` — still listable |
| **Paginated full scan** | Client can merge pages until `has_next_page === false` and retain unique URLs |
| **Future:** catalogue row for Matrix file | Appears in **`org_memory_assets`** or sibling tool with `source: matrix_chat` (after implementation) |
