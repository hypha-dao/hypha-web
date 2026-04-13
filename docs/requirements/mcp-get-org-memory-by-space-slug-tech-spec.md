# Technical Specification — MCP tool `get_org_memory_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Ready for implementation |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Scope** | Read-only MCP tool that returns the **organisation memory projection** for a space: **v1** = full **member roster** (people + spaces-as-members, `memberships` columns, join metadata) identical to `get_people_by_space_slug`, plus a **stable extension slot** `org_memory_assets` (empty until the org memory catalogue ships). **Does not** duplicate `get_documents_by_space_slug`; callers use both tools when they need documents + org memory. |
| **Parity** | Same pattern as **`get_people_by_space_slug`** and **`get_documents_by_space_slug`**: Zod `inputSchema` / `outputSchema`, `structuredContent`, `readOnlyHint` / `idempotentHint`, `HYPHA_MCP_AUTH_TOKEN` for `checkSpaceAccessForSpace`, shared core entry `getSpaceMembersRoster` + `serializeSpaceMembersRosterDatesForJson` for the **members** slice |

---

## 1) Problem statement

Assistants and Hypha Chat need a **single named tool** aligned with **organisation memory** and epic #2027 that exposes:

1. **Members of the space** — people and **other spaces** that appear as on-chain members (Members tab parity), including **join date** (`joined_at`), **`join_source`**, and **every column** from the **`memberships`** row when the person is linked in the database.
2. A **forward-compatible** payload for **catalogued assets** (Matrix uploads, proposal files, excerpts) without breaking hosts when the catalogue lands.

**Relationship to existing tools**

| Tool | Responsibility |
|------|------------------|
| `get_people_by_space_slug` | Roster only; keep for backward compatibility and narrow “who is in this space?” prompts. |
| `get_documents_by_space_slug` | SQL `documents` + attachments / lead image URLs. |
| **`get_org_memory_by_space_slug`** | **Org memory umbrella**: **v1** roster (same data as people tool) + **`org_memory_assets`** (v1: always `[]`; v2+: catalogue rows per [documents-and-media-overview §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work)). |

Implementers SHOULD reuse the **same** roster computation and serialization as `get_people_by_space_slug` to avoid drift (one function: `getSpaceMembersRoster`).

---

## 2) Source of truth (data model)

### 2.1 Members slice (v1)

- **Computation:** `getSpaceMembersRoster` in `packages/core/src/space/server/get-space-members-roster.ts` (same as MCP `get_people_by_space_slug` handler in `packages/mcp-server/src/main.ts`).
- **Membership table:** `memberships` — `packages/storage-postgres/src/schema/membership.ts` (`id`, `person_id`, `space_id`, `created_at`, `updated_at`). Exposed on person entries as **`membership`** with **snake_case** keys in JSON (`id`, `person_id`, `space_id`, `created_at`, `updated_at`) — match existing `getPeopleBySpaceSlugOutputSchema` in `packages/mcp-server/src/get-people-by-space-slug-schema.ts`.
- **On-chain roster:** Member addresses from `getSpaceDetails` when `web3SpaceId` is set; **`source_chain: "rpc"`** when the chain read succeeded, else `null` (same semantics as roster tool).
- **Space-type members:** No `memberships` row; **`membership: null`**, **`join_source`**: `event` \| `unknown`, **`joined_at`** from join events when available.

### 2.2 Assets slice (`org_memory_assets`)

**v1 (this implementation):** The array MUST be present and MUST be **`[]`**.

**Future (catalogue):** Populate per [mcp-get-documents-by-space-slug-tech-spec.md §8.1](./mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target) — rows with `source`, `filename`, `mime`, `app_url` | `mxc_uri`, optional `matrix_room_id`, `matrix_event_id`, `document_id`, optional `fetch_url` / `text_excerpt`. Matrix-only files MUST NOT be invented from SQL `documents`; they require catalogue ingestion.

### 2.3 Explicit non-scope (v1)

- **Not** listing child subspaces by `parent_id` unless they appear as **space-type members** in the on-chain set.
- **Not** returning raw document rows (use `get_documents_by_space_slug`).
- **Not** resolving `mxc://` to bytes in the tool response (metadata only until authenticated fetch exists).

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-1** | The system SHALL expose an MCP tool named **`get_org_memory_by_space_slug`**. |
| **FR-2** | The tool SHALL be **read-only** and **idempotent** (`readOnlyHint`, `idempotentHint`). |
| **FR-3** | Inputs SHALL match **`get_people_by_space_slug`**: **`space_slug`**, **`page`** (default 1), **`page_size`** (default 20, max 100), optional **`searchTerm`**. |
| **FR-4** | Output SHALL include **`found`**, **`space_slug`**, **`space`** (`id`, `slug`, `title`, `parent_id`) or `null`, **`source: "db"`**, **`source_chain`**: `"rpc"` \| `null`, **`asOf`**, **`members`** (same shape and semantics as `get_people_by_space_slug` / `getPeopleBySpaceSlugOutputSchema.members`), **`pagination`** (snake_case keys: `page_size`, `total_pages`, `has_next_page`, `has_previous_page`, plus `total`, `page`), **`org_memory_assets`** as a JSON array (**empty in v1**). |
| **FR-5** | For each **person** member, the tool SHALL expose the **full `memberships`** record when present (all columns §2.1), serialized in snake_case inside **`membership`**, or `null` when the person is on-chain only. |
| **FR-6** | Access control SHALL mirror **`get_people_by_space_slug`**: when the host space exists and has **`web3SpaceId`**, call **`checkSpaceAccessForSpace(host, HYPHA_MCP_AUTH_TOKEN)`** before querying; on denial return **`isError: true`** with access message as text (no structured payload). Spaces **without** `web3SpaceId` are **open** for reads. |
| **FR-7** | Invalid **`space_slug`** SHALL fail **Zod** validation before DB/RPC (reuse **`spaceSlugSchema`** from `@hypha-platform/core/server` or the same regex rules as `get-people-by-space-slug-schema.ts`). |
| **FR-8** | Unknown slug SHALL return **`found: false`**, `space: null`, empty **`members`**, empty **`org_memory_assets`**, pagination zeros — **not** a transport-level MCP error. |
| **FR-9** | Serialize all **`Date`** fields in nested objects as **ISO-8601 strings** via **`serializeSpaceMembersRosterDatesForJson`** before Zod validation. |
| **FR-10** | After building the payload, the server SHALL validate **`structuredContent`** with **`getOrgMemoryBySpaceSlugOutputSchema`**: extend **`getPeopleBySpaceSlugOutputSchema`** with **`org_memory_assets`** validated as **exactly an empty array in v1** (for example `z.array(z.never())`, or `z.array(z.unknown()).refine((a) => a.length === 0, { message: 'org_memory_assets must be empty in v1' })` — pick one and add a unit test). |

---

## 4) Contract (Zod + MCP registration)

### 4.1 Input schema

New file: `packages/mcp-server/src/get-org-memory-by-space-slug-schema.ts`.

- Reuse the same **`space_slug`**, **`page`**, **`page_size`**, **`searchTerm`** definitions as `getPeopleBySpaceSlugInputSchema` (or import and alias `getPeopleBySpaceSlugInputSchema` as `getOrgMemoryBySpaceSlugInputSchema` if identical).

### 4.2 Output schema

- Base: **`getPeopleBySpaceSlugOutputSchema`** (`packages/mcp-server/src/get-people-by-space-slug-schema.ts`).
- Add **`org_memory_assets`**: **v1** = empty array only (see **FR-10**). When the catalogue ships, replace the empty constraint with a documented **`orgMemoryAssetSchema`** (fields per [mcp-get-documents-by-space-slug-tech-spec.md §8.1](./mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target)).

Export **`GetOrgMemoryBySpaceSlugInput`** / **`GetOrgMemoryBySpaceSlugOutput`** inferred types.

### 4.3 Registration

In `packages/mcp-server/src/main.ts`:

1. Import schemas.
2. `server.registerTool('get_org_memory_by_space_slug', { description, inputSchema, outputSchema, annotations }, handler)`.
3. Handler logic = copy **`get_people_by_space_slug`** handler, then set **`org_memory_assets: []`** on the structured object before validation **or** validate roster portion then spread `{ org_memory_assets: [] }`.

Update **`McpServer` `instructions`** string to mention the new tool.

### 4.4 README

`packages/mcp-server/README.md`: document env var, tool name, and one-line distinction vs `get_people_by_space_slug` / `get_documents_by_space_slug`.

---

## 5) Security and operations

- **`HYPHA_MCP_AUTH_TOKEN`**: unchanged (Privy JWT).
- **Rate limits:** same as roster (RPC for member addresses).
- **Matrix / catalogue (future):** When `org_memory_assets` contains `mxc_uri`, resolution for fetch MUST use server-side Matrix credentials — see [documents-and-media-overview §4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai) and [mcp-get-documents-by-space-slug-tech-spec §8.2–8.3](./mcp-get-documents-by-space-slug-tech-spec.md#82-ai-opening-documents-images-and-video).

---

## 6) Testing checklist

| Test | Expected |
|------|----------|
| Public space, no token | Same roster as `get_people_by_space_slug`; `org_memory_assets` is `[]` |
| Restricted space, no token | `isError: true`, access message |
| Restricted space, valid token | Roster + empty `org_memory_assets` |
| Bad slug | Zod validation error |
| Unknown slug | `found: false`, empty members and assets |
| Output schema | Passes `getOrgMemoryBySpaceSlugOutputSchema.safeParse` |
| **Step 3:** catalogue + Matrix row | At least one **`org_memory_assets`** item with **`source: matrix_chat`** and **`mxc_uri`**; restricted space without token → `isError` |
| **Step 3:** proposal row in catalogue | Row with **`source`** proposal/upload and **`app_url`** or **`document_id`** |

---

## 7) References

- Epic: [#2027](https://github.com/hypha-dao/hypha-web/issues/2027)
- Sibling tools: `mcp-get-people-by-space-slug-tech-spec.md`, `mcp-get-documents-by-space-slug-tech-spec.md` §8
- Architecture: [documents-and-media-overview.md §4–§4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai)
- UI / plan cross-links: [space-memory-panel.md §1 (phased delivery — Step 3)](../plans/space-memory-panel.md#1-phased-delivery--panel-mcp-and-matrix-assets), [§9](../plans/space-memory-panel.md#9-mcp--hypha-chat-ai)
- Chat integration: [chat-ai-get-org-memory-by-space-slug-integration.md](./chat-ai-get-org-memory-by-space-slug-integration.md)

---

## 8) Amendment — Step 3 (Space Memory panel + Matrix assets)

When the **org memory catalogue** lists **Matrix** rows, update this spec and the Zod output schema as follows:

| ID | Requirement |
|----|----------------|
| **FR-11** | **`org_memory_assets`** SHALL list catalogue rows for the space including **`source: matrix_chat`** (and proposal-backed rows as defined in architecture §4.3), each row matching the field set in [mcp-get-documents-by-space-slug-tech-spec.md §8.1](./mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target) (`filename`, `mime`, `mxc_uri` and/or `app_url`, optional `matrix_room_id`, `matrix_event_id`, `document_id`, optional `fetch_url` / `text_excerpt`). |
| **FR-12** | The MCP server SHALL apply the **same** **`checkSpaceAccessForSpace`** gate **before** returning any **`org_memory_assets`** entry as for **`members`**. |
| **FR-13** | **Pagination (assets):** If the combined asset count can exceed **`page_size`**, the implementation SHALL either (a) paginate **`org_memory_assets`** with explicit input fields **`assets_page`** / **`assets_page_size`** (defaults aligned with roster pagination), or (b) document a **cursor**-based follow-up in a minor spec revision — pick (a) or (b) in the implementing PR and update this table. **Roster pagination** (`page`, `page_size`) semantics for **`members`** remain unchanged from **`get_people_by_space_slug`**. |
| **FR-14** | The **Space Memory panel** SHALL consume the **same core read** used to populate **`get_org_memory_by_space_slug`** (see [space-memory-panel.md §1 Step 3](../plans/space-memory-panel.md#step-3--implementation-checklist-ready-for-tickets)) so UI and MCP do not diverge. |

Matrix-only bytes are still **not** inlined in JSON; **`mxc_uri`** is metadata unless **`fetch_url`** or excerpts are supplied by the catalogue pipeline.
