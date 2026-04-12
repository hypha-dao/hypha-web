# Technical Specification — MCP tool `get_documents_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Implemented (see `packages/mcp-server` + `packages/core/src/governance/server/get-documents-by-space-slug.ts`) |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Scope** | Read-only MCP tool listing **documents** stored for a space (PostgreSQL `documents` table), with **creator resolution** (person or space creator), **pagination**, optional **full-text search**, optional **`state` filter**, and the **same non-public space access gating** as `get_people_by_space_slug` |
| **Parity** | Same pattern as **`get_people_by_space_slug`**: Zod `inputSchema` / `outputSchema`, `structuredContent`, `readOnlyHint` / `idempotentHint`, `HYPHA_MCP_AUTH_TOKEN` for `checkSpaceAccessForSpace` |

---

## 1) Problem statement

Assistants need a **typed, paginated** way to answer:

- “What **proposals / discussions / agreements** exist in this space?”
- “**Search** documents by keywords in title or description.”
- “Who **created** this document?” (resolved `creator` object on each row)

without scraping the UI or hallucinating content. This is **distinct** from the **member roster** (`get_people_by_space_slug`) and from **aggregate document counts** on `get_space_by_slug`.

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

**FR:** The tool SHALL return **every scalar field** on `Document` from `mapToDocument` in `@hypha-platform/core` governance types (`packages/core/src/governance/types.ts`), plus optional **`creator`** (avatar, name/surname or space title, type `person` \| `space`, address).

**Explicit non-requirement:** This tool does **not** join coherence/Matrix “org memory” catalogues, token rows, or vote tallies unless a follow-up epic extends the contract. Token / agreement side tables remain out of scope here.

### 2.2 Query implementation

Single entry point in core: **`getDocumentsBySpaceSlug`** (`packages/core/src/governance/server/get-documents-by-space-slug.ts`), which delegates listing to **`findAllDocumentsBySpaceSlug`** (`packages/core/src/governance/server/queries.ts`):

- `INNER JOIN spaces ON documents.space_id = spaces.id WHERE spaces.slug = :spaceSlug`
- Optional **`searchTerm`**: same `to_tsvector` / `plainto_tsquery` filter as the app list.
- Optional **`state`**: `discussion` \| `proposal` \| `agreement`.
- **Order:** `createdAt` **DESC** (explicit in the core call; SQL also defaults when `order` is empty — see `queries.ts` fix for empty `orderBy`).

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
- Org memory / catalogue context (separate product surface): PR [#2133](https://github.com/hypha-dao/hypha-web/pull/2133), [#2138](https://github.com/hypha-dao/hypha-web/pull/2138)
