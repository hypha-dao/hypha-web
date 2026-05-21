# Technical Specification — MCP tool `get_org_memory_by_space_slug`

## Document control

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status** | Implemented: **`getOrgMemoryBySpaceSlug`** in `@hypha-platform/core/server`, MCP + Chat tools, **`GET /api/v1/spaces/[spaceSlug]/org-memory`** for the Space Memory panel                                                                                                                                                                                                                                                           |
| **Epic**   | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027)                                                                                                                                                                                                                                                                                                                                      |
| **Scope**  | Read-only MCP tools: **`get_org_memory_by_space_slug`** returns roster + **`org_memory_assets`**; **`fetch_org_memory_asset`** reads content by **`asset_key`**: text/PDF, base64 for **image / video / Office** (no speech-to-text in v1). Matrix verification uses **GET `/event`** (not the listing window). Caps: **`max_bytes`**, timeouts. **Does not** duplicate full SQL document rows (use `get_documents_by_space_slug`). |
| **Parity** | Same pattern as **`get_people_by_space_slug`** and **`get_documents_by_space_slug`**: Zod `inputSchema` / `outputSchema`, `structuredContent`, `readOnlyHint` / `idempotentHint`, `HYPHA_MCP_AUTH_TOKEN` for `checkSpaceAccessForSpace`, shared core entry `getSpaceMembersRoster` + `serializeSpaceMembersRosterDatesForJson` for the **members** slice                                                                            |

---

## 1) Problem statement

Assistants and Hypha Chat need a **single named tool** aligned with **organisation memory** and epic #2027 that exposes:

1. **Members of the space** — people and **other spaces** that appear as on-chain members (Members tab parity), including **join date** (`joined_at`), **`join_source`**, and **every column** from the **`memberships`** row when the person is linked in the database.
2. A **forward-compatible** payload for **catalogued assets** (Matrix uploads, proposal files, excerpts) without breaking hosts when the catalogue lands.

**Relationship to existing tools**

| Tool                               | Responsibility                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_people_by_space_slug`         | Roster only; keep for backward compatibility and narrow “who is in this space?” prompts.                                                                                                                                                                            |
| `get_documents_by_space_slug`      | SQL `documents` + attachments / lead image URLs.                                                                                                                                                                                                                    |
| **`get_org_memory_by_space_slug`** | **Org memory umbrella**: roster + **`org_memory_assets`** (metadata + **`asset_key`** per row).                                                                                                                                                                     |
| **`fetch_org_memory_asset`**       | **Content access**: **`space_slug`** + **`asset_key`**; Matrix verifies **room+event** references **mxc** via **GET `/rooms/{roomId}/event/{eventId}`**, then **`/_matrix/media/v3/download`** with **Bearer** (query fallback); proposals via HTTPS **`app_url`**. |

Implementers SHOULD reuse the **same** roster computation and serialization as `get_people_by_space_slug` to avoid drift (one function: `getSpaceMembersRoster`).

---

## 2) Source of truth (data model)

### 2.1 Members slice (v1)

- **Computation:** `getSpaceMembersRoster` in `packages/core/src/space/server/get-space-members-roster.ts` (same as MCP `get_people_by_space_slug` handler in `packages/mcp-server/src/main.ts`).
- **Membership table:** `memberships` — `packages/storage-postgres/src/schema/membership.ts` (`id`, `person_id`, `space_id`, `created_at`, `updated_at`). Exposed on person entries as **`membership`** with **snake_case** keys in JSON (`id`, `person_id`, `space_id`, `created_at`, `updated_at`) — match existing `getPeopleBySpaceSlugOutputSchema` in `packages/mcp-server/src/get-people-by-space-slug-schema.ts`.
- **On-chain roster:** Member addresses from `getSpaceDetails` when `web3SpaceId` is set; **`source_chain: "rpc"`** when the chain read succeeded, else `null` (same semantics as roster tool).
- **Space-type members:** No `memberships` row; **`membership: null`**, **`join_source`**: `event` \| `unknown`, **`joined_at`** from join events when available.

### 2.2 Assets slice (`org_memory_assets`)

**Implemented:** The array is present and lists **proposal-backed** URLs (`source: proposal_upload`, `app_url`, `document_id`, optional document metadata) and **Matrix-backed** rows (`source: matrix_chat`, `mxc_uri`, `matrix_room_id`, `matrix_event_id`) when the homeserver + token + `chat_room_id` allow timeline read. Each row includes **`asset_key`** (opaque base64url JSON) stable for **`fetch_org_memory_asset`**.

**Future (catalogue / search):** Optional additive fields per [mcp-get-documents-by-space-slug-tech-spec.md §8.1](./mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target) — e.g. **`text_excerpt`**, **`indexed_text_ref`**, **`fetch_url`** — may be added without removing **`asset_key`**.

### 2.3 Content fetch (`fetch_org_memory_asset`)

- **Input:** `space_slug`, `asset_key`, optional `return_mode` (`auto` \| `text_only` \| `binary_as_base64`), optional `max_bytes` (default 2 MiB, max 4 MiB).
- **Proposal assets:** `asset_key` encodes `document_id` + `app_url`; server verifies the URL belongs to that document in the space, then **GET** the HTTPS URL (no Matrix token).
- **Matrix assets:** `asset_key` encodes `room_id` + `event_id` + `mxc_uri`. Server calls **`GET /_matrix/client/v3/rooms/{roomId}/event/{eventId}`** with **Bearer** (query `access_token` fallback on 401), extracts **`m.file` / `m.image`** and **`org.hypha.media_bundle`** MXC URLs, and requires **`mxc_uri`** to match — **independent of** the **`/messages`** listing depth. Media download: **`/_matrix/media/v3/download`** with **Bearer** (query fallback), **not** token embedded in logs by default for the messages listing path.
- **Processing:** `auto` — UTF-8 **text/** → text; **application/pdf** → **pdf-parse** (truncated); **image/\***, **video/\***, common **Office** MIME (docx/xlsx/pptx + legacy msword types) → **base64** for MCP/Chat (Hypha Chat: **`image-data`** for images, **`file-data`** for video/Office — **no** auto transcription in v1). `text_only` skips binary. `binary_as_base64` allows image, video, pdf, Office MIME types.

### 2.4 Explicit non-scope

- **Not** listing child subspaces by `parent_id` unless they appear as **space-type members** in the on-chain set.
- **Not** returning full governance document rows in **`get_org_memory_by_space_slug`** (use `get_documents_by_space_slug`).
- **Not** inlining multi‑MiB binaries in **`get_org_memory_by_space_slug`** listing responses (use **`fetch_org_memory_asset`**).

### 2.5 Activity-signal quality policy (AI context)

Because this tool is the AI memory umbrella, activity context MUST be high-signal and
exclude telemetry/debug noise that does not improve reasoning quality.

**Exclude as noise (do not model as activity facts):**

- UI/session telemetry (clicks, scroll depth, panel open/close, viewport dimensions)
- low-level delivery mechanics (typing indicators, reconnect churn, read-receipt internals)
- transient presence chatter (heartbeat/ping noise, reconnect join/leave flaps)
- debug/trace internals (stack traces, retry internals, verbose transport logs)
- redundant snapshots (full-state repeats without meaningful semantic change)
- raw binary payloads as activity records (store URI/metadata/transcript, not media bytes)
- duplicate cross-channel copies without new context
- non-essential PII (device IDs, IPs, user-agent strings) unless explicitly approved

**Keep as required activity intelligence:**

- actor + action + timestamp + canonical reference (`space_slug`, `doc slug`, `asset_key`, `call_session_id`)
- decision artifacts (proposal/vote/outcome/rationale)
- conversation intelligence (summary, key quotes, participant set)
- call intelligence (transcript, summary, action items, recording URI)
- meaningful document deltas (semantic revision events, not keystroke logs)
- task lifecycle transitions (opened/assigned/completed/blocked)

Rule: if a record cannot help answer **what happened, why, and what changed**, it is out of scope for AI memory context.

---

## 3) Functional requirements

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-1**  | The system SHALL expose an MCP tool named **`get_org_memory_by_space_slug`**.                                                                                                                                                                                                                                                                         |
| **FR-2**  | The tool SHALL be **read-only** and **idempotent** (`readOnlyHint`, `idempotentHint`).                                                                                                                                                                                                                                                                |
| **FR-3**  | Inputs SHALL match **`get_people_by_space_slug`**: **`space_slug`**, **`page`** (default 1), **`page_size`** (default 20, max 100), optional **`searchTerm`**.                                                                                                                                                                                        |
| **FR-4**  | Output SHALL include **`found`**, **`space_slug`**, **`space`**, **`source: "db"`**, **`source_chain`**, **`asOf`**, **`members`**, **`pagination`**, **`org_memory_assets`** (each with optional **`asset_key`**), **`assets_pagination`**, **`matrix_fetch`**.                                                                                      |
| **FR-5**  | For each **person** member, the tool SHALL expose the **full `memberships`** record when present (all columns §2.1), serialized in snake_case inside **`membership`**, or `null` when the person is on-chain only.                                                                                                                                    |
| **FR-6**  | Access control SHALL mirror **`get_people_by_space_slug`**: when the host space exists and has **`web3SpaceId`**, call **`checkSpaceAccessForSpace(host, HYPHA_MCP_AUTH_TOKEN)`** before querying; on denial return **`isError: true`** with access message as text (no structured payload). Spaces **without** `web3SpaceId` are **open** for reads. |
| **FR-7**  | Invalid **`space_slug`** SHALL fail **Zod** validation before DB/RPC (reuse **`spaceSlugSchema`** from `@hypha-platform/core/server` or the same regex rules as `get-people-by-space-slug-schema.ts`).                                                                                                                                                |
| **FR-8**  | Unknown slug SHALL return **`found: false`**, `space: null`, empty **`members`**, empty **`org_memory_assets`**, pagination zeros — **not** a transport-level MCP error.                                                                                                                                                                              |
| **FR-9**  | Serialize all **`Date`** fields in nested objects as **ISO-8601 strings** via **`serializeSpaceMembersRosterDatesForJson`** before Zod validation.                                                                                                                                                                                                    |
| **FR-10** | After building the payload, the server SHALL validate **`structuredContent`** with **`getOrgMemoryBySpaceSlugOutputSchema`** (including **`org_memory_assets`** items and optional **`asset_key`**).                                                                                                                                                  |
| **FR-15** | The system SHALL expose MCP tool **`fetch_org_memory_asset`** with **`readOnlyHint`** / **`idempotentHint`**, same **`checkSpaceAccessForSpace`** rules, **`fetchOrgMemoryAssetOutputSchema`** validation, and documented **`max_bytes`** / timeout behaviour (see §2.3).                                                                             |
| **FR-16** | Any activity metadata surfaced through `org_memory_assets` or related enrichment SHALL comply with §2.5 signal policy: include semantic activity events and exclude telemetry/debug noise.                                                                                                                                                               |

---

## 4) Contract (Zod + MCP registration)

### 4.1 Input schema

New file: `packages/mcp-server/src/get-org-memory-by-space-slug-schema.ts`.

- Reuse the same **`space_slug`**, **`page`**, **`page_size`**, **`searchTerm`** definitions as `getPeopleBySpaceSlugInputSchema` (or import and alias `getPeopleBySpaceSlugInputSchema` as `getOrgMemoryBySpaceSlugInputSchema` if identical).

### 4.2 Output schema

- Base: **`getPeopleBySpaceSlugOutputSchema`** (`packages/mcp-server/src/get-people-by-space-slug-schema.ts`).
- Add **`org_memory_assets`**: **`orgMemoryAssetSchema`** including optional **`asset_key`**, **`source`**, **`filename`**, **`mime`**, **`app_url`**, **`mxc_uri`**, optional Matrix and document metadata (see `packages/mcp-server/src/get-org-memory-by-space-slug-schema.ts`).

Export **`GetOrgMemoryBySpaceSlugInput`** / **`GetOrgMemoryBySpaceSlugOutput`** inferred types.

### 4.3 Registration

In `packages/mcp-server/src/main.ts`:

1. Import schemas.
2. `server.registerTool('get_org_memory_by_space_slug', { description, inputSchema, outputSchema, annotations }, handler)`.
3. Handler calls **`getOrgMemoryBySpaceSlug`** from core (roster + assets + pagination + **`matrix_fetch`**).
4. Register **`fetch_org_memory_asset`** (`packages/mcp-server/src/fetch-org-memory-asset-schema.ts`, handler in `main.ts`).

Update **`McpServer` `instructions`** string to mention the new tool.

### 4.4 README

`packages/mcp-server/README.md`: document env var, tool name, and one-line distinction vs `get_people_by_space_slug` / `get_documents_by_space_slug`.

---

## 5) Security and operations

- **`HYPHA_MCP_AUTH_TOKEN`**: unchanged (Privy JWT).
- **Rate limits:** same as roster (RPC for member addresses).
- **Matrix fetch:** **`fetch_org_memory_asset`** MUST use server-side Matrix credentials for **`mxc_uri`** (never assume browser-only `mxcUrlToHttp`) — see [documents-and-media-overview §4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai) and [mcp-get-documents-by-space-slug-tech-spec §8.2–8.3](./mcp-get-documents-by-space-slug-tech-spec.md#82-ai-opening-documents-images-and-video).
- **Data minimization for AI:** enforce §2.5 by excluding telemetry/debug/PII noise from memory records and summaries.

---

## 6) Testing checklist

| Test                                  | Expected                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Public space, no token                | Same roster as `get_people_by_space_slug`; `org_memory_assets` may list proposal/Matrix rows when data exists                          |
| Restricted space, no token            | `isError: true`, access message                                                                                                        |
| Restricted space, valid token         | Roster + `org_memory_assets` with **`asset_key`** on rows                                                                              |
| Bad slug                              | Zod validation error                                                                                                                   |
| Unknown slug                          | `found: false`, empty members and assets                                                                                               |
| Output schema                         | Passes `getOrgMemoryBySpaceSlugOutputSchema.safeParse`                                                                                 |
| **Step 3:** catalogue + Matrix row    | At least one **`org_memory_assets`** item with **`source: matrix_chat`** and **`mxc_uri`**; restricted space without token → `isError` |
| **Step 3:** proposal row in catalogue | Row with **`source`** proposal/upload and **`app_url`** or **`document_id`**                                                           |
| Activity noise policy                 | Activity records included in memory exclude noise classes in §2.5 and preserve canonical retrieval IDs                                 |

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

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FR-11** | **`org_memory_assets`** SHALL list catalogue rows for the space including **`source: matrix_chat`** (and proposal-backed rows as defined in architecture §4.3), each row matching the field set in [mcp-get-documents-by-space-slug-tech-spec.md §8.1](./mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target) (`filename`, `mime`, `mxc_uri` and/or `app_url`, optional `matrix_room_id`, `matrix_event_id`, `document_id`, optional `fetch_url` / `text_excerpt`).                                                     |
| **FR-12** | The MCP server SHALL apply the **same** **`checkSpaceAccessForSpace`** gate **before** returning any **`org_memory_assets`** entry as for **`members`**.                                                                                                                                                                                                                                                                                                                                                                                   |
| **FR-13** | **Pagination (assets):** If the combined asset count can exceed **`page_size`**, the implementation SHALL either (a) paginate **`org_memory_assets`** with explicit input fields **`assets_page`** / **`assets_page_size`** (defaults aligned with roster pagination), or (b) document a **cursor**-based follow-up in a minor spec revision — pick (a) or (b) in the implementing PR and update this table. **Roster pagination** (`page`, `page_size`) semantics for **`members`** remain unchanged from **`get_people_by_space_slug`**. |
| **FR-14** | The **Space Memory panel** SHALL consume the **same core read** used to populate **`get_org_memory_by_space_slug`** (see [space-memory-panel.md §1 Step 3](../plans/space-memory-panel.md#step-3--implementation-checklist-ready-for-tickets)) so UI and MCP do not diverge.                                                                                                                                                                                                                                                               |

Matrix bytes are **not** inlined in **`get_org_memory_by_space_slug`**; use **`fetch_org_memory_asset`** with **`asset_key`**. Optional catalogue **`fetch_url`** / **`text_excerpt`** remain additive for future search UX.

### 8.1) Matrix discovery (implemented without catalogue table)

- **Auth (bot / service):** `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` is a Matrix **access_token** (user joined to the space room), passed as **`access_token`** on the `/messages` request (not `Authorization: Bearer`, which Synapse rejects for Matrix tokens).
- **Auth (session, web + Hypha Chat):** When the bot token is unset, org memory may use the **caller's** Matrix token from **`matrix_user_links`** (same store as `GET /api/matrix/token`) if a **Privy JWT** is available and a request URL is supplied for `determineEnvironment` (web: request URL; MCP: optional **`HYPHA_MCP_MATRIX_REQUEST_URL`** or **`VERCEL_URL`**).
- **Room:** `spaces.chat_room_id` (loaded via `findSpaceHostFieldsBySlug`).
- **Events:** Standard `m.room.message` with `m.file` / `m.image` and **`org.hypha.media_bundle`** slots (same wire shape as Human Chat).
- **Diagnostics:** Response field **`matrix_fetch`** reports skip reasons, **`used_bot_access_token`**, **`used_session_matrix_token`**, **`session_matrix_token_unavailable`**, HTTP status, chunk size, and parse counts when no `matrix_chat` rows appear.
