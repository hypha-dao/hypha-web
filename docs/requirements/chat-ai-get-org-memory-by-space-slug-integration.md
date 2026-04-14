# Technical Specification — Chat AI integration for `get_org_memory_by_space_slug`

## Document control

| Field             | Value                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**        | Implemented (`packages/chat-server`: `createGetOrgMemoryBySpaceSlugTool`, `createChatTools`, `system-prompt.ts`)                                                                                                                                            |
| **Epic**          | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027)                                                                                                                                                              |
| **Depends on**    | Core **`getSpaceMembersRoster`**, **`serializeSpaceMembersRosterDatesForJson`**, **`@hypha-platform/chat-server`** tool registration; mirrors [chat-ai-get-people-by-space-slug-integration.md](./chat-ai-get-people-by-space-slug-integration.md) patterns |
| **MCP reference** | [mcp-get-org-memory-by-space-slug-tech-spec.md](./mcp-get-org-memory-by-space-slug-tech-spec.md)                                                                                                                                                            |

---

## 1) Objective

Enable **Hypha Chat AI** to call a **single org-memory-oriented tool** that returns:

- The **full member roster** for a space (people + spaces-as-members, **`memberships`** fields, **`joined_at`** / **`join_source`**) — **same payload slice as** `get_people_by_space_slug`.
- **`org_memory_assets`**: **`[]` in v1**; later, catalogue-backed files for RAG-aware questions without renaming the tool.

The model uses **`get_documents_by_space_slug`** when the user asks about **proposals / documents / attachments on document rows**. It uses **`get_org_memory_by_space_slug`** when the product intent is **“organisation memory”**, **roster + future indexed assets**, or **explicit “space memory”** wording (see system prompt rules below).

---

## 2) Parity with MCP and core

| Concern                   | Approach                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single implementation** | Chat tool calls **`getSpaceMembersRoster({ spaceSlug, page, pageSize, searchTerm }, { db })`** then **`serializeSpaceMembersRosterDatesForJson`**, identical to `createGetPeopleBySpaceSlugTool`, then attaches **`org_memory_assets: []`** (v1). |
| **Access**                | Same as people tool: **`findSpaceBySlug`** → if **`web3SpaceId`** set and convertible, **`checkSpaceAccessForSpace(host, authToken)`** with the chat route token; on denial return **`{ found: false, space_slug, error }`** (do not throw).      |
| **Slug hygiene**          | **`sanitizeSlug`** from `system-prompt.ts` before any query.                                                                                                                                                                                      |
| **Output**                | Return object matching MCP **`structuredContent`** shape: all roster fields + **`org_memory_assets: []`**.                                                                                                                                        |
| **Errors**                | RPC/DB failures → **`{ found: false, space_slug, error }`** — match `get_people_by_space_slug` / `get_documents_by_space_slug` chat tools.                                                                                                        |

---

## 3) Functional requirements

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-OC1** | Register tool **`get_org_memory_by_space_slug`** in **`createChatTools`** (`packages/chat-server/src/tools/index.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **FR-OC2** | `inputSchema`: **`space_slug`**, **`page`**, **`page_size`**, optional **`searchTerm`** (Zod; same constraints as people tool).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **FR-OC3** | Export **`createGetOrgMemoryBySpaceSlugTool`** from `packages/chat-server/src/tools/get-org-memory-by-space-slug.ts` (new file).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **FR-OC4** | Tool description SHALL state: org memory projection; **v1** = roster + empty **`org_memory_assets`**; not a substitute for **`get_documents_by_space_slug`** for governance document lists.                                                                                                                                                                                                                                                                                                                                                                 |
| **FR-OC5** | **`buildSystemPrompt`** (space-scoped): when **`spaceSlug`** is present, add bullets: (a) use **`get_org_memory_by_space_slug`** for questions about **space memory**, **org memory**, **Coherence / Space Memory**, or **“what the space knows”** (roster today; assets when populated); (b) use **`get_people_by_space_slug`** for a plain **member list / roster / who joined** question without that framing — **same data** for the **`members`** slice in v1; (c) use **`get_documents_by_space_slug`** for governance documents and attachment URLs. |
| **FR-OC6** | When the user asks to **paginate through all members** in org-memory context, the prompt SHALL instruct merging pages until **`has_next_page`** is false (same as documents tool instruction).                                                                                                                                                                                                                                                                                                                                                              |

---

## 4) Implementation map

1. **`packages/chat-server/src/tools/get-org-memory-by-space-slug.ts`** — `createGetOrgMemoryBySpaceSlugTool(authToken)` mirroring `get-people-by-space-slug.ts`, appending **`org_memory_assets: []`** to the successful serialized result.
2. **`packages/chat-server/src/tools/index.ts`** — add **`get_org_memory_by_space_slug`** to the tools map.
3. **`packages/chat-server/src/system-prompt.ts`** — extend the space-scoped bullet list with **`get_org_memory_by_space_slug`** and disambiguation vs documents and (optionally) people tool.

---

## 5) Testing

| Test   | Expected                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual | Space-scoped chat asks “who is in this space’s org memory”; model calls **`get_org_memory_by_space_slug`**; response includes **`members`** and **`org_memory_assets: []`**. |
| Access | Restricted space without token → **`error`** string matching roster behaviour.                                                                                               |
| Parity | Same **`members`** page as **`get_people_by_space_slug`** for identical inputs.                                                                                              |

---

## 6) Step 3 — Chat after catalogue (Matrix + proposals in `org_memory_assets`)

When **`org_memory_assets`** is populated (see [space-memory-panel.md §1 Step 3](../plans/space-memory-panel.md#step-3--implementation-checklist-ready-for-tickets) and MCP spec **§8** [mcp-get-org-memory-by-space-slug-tech-spec.md](./mcp-get-org-memory-by-space-slug-tech-spec.md)):

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-OC7** | The tool return shape SHALL include the **same** **`org_memory_assets`** array the MCP tool exposes (parity object).                                                                                                                                                                                                                                                                                                                                                              |
| **FR-OC8** | **`buildSystemPrompt`** SHALL instruct: for **“all files the space remembers”**, **“chat attachments + proposals”**, or **Space Memory** phrasing, call **`get_org_memory_by_space_slug`** and paginate **assets** per MCP **FR-13** when applicable; use **`get_documents_by_space_slug`** for **per-document governance** fields (`state`, `status`, creator).                                                                                                                  |
| **FR-OC9** | When explaining **missing Matrix** rows, the model SHALL use **`matrix_fetch`** holistically: **`access_token_configured`** is **only** the bot env **`HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN`**; **`used_session_matrix_token`** means the viewer’s Human Chat Matrix token was used; **`session_matrix_token_unavailable`** means the JWT was present but no valid Matrix link. The model SHALL **not** claim Matrix is impossible **solely** because the bot token env is unset. |

---

## 7) References

- MCP spec: [mcp-get-org-memory-by-space-slug-tech-spec.md](./mcp-get-org-memory-by-space-slug-tech-spec.md)
- People chat spec pattern: [chat-ai-get-documents-by-space-slug-integration.md](./chat-ai-get-documents-by-space-slug-integration.md)
- Architecture: [documents-and-media-overview.md §4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai)
- Plan: [space-memory-panel.md §1](../plans/space-memory-panel.md#1-phased-delivery--panel-mcp-and-matrix-assets), [§9](../plans/space-memory-panel.md#9-mcp--hypha-chat-ai)
