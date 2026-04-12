# Technical Specification — Chat AI integration for `get_documents_by_space_slug`

## Document control

| Field | Value |
|-------|--------|
| **Status** | Implemented (`packages/chat-server`: `createGetDocumentsBySpaceSlugTool`, `createChatTools`, `system-prompt.ts`) |
| **Epic** | [Expand Hypha MCP read API coverage #2027](https://github.com/hypha-dao/hypha-web/issues/2027) |
| **Depends on** | Core **`getDocumentsBySpaceSlug`**, **`findAllDocumentsBySpaceSlug`**, **`@hypha-platform/chat-server`** tool registration |
| **Reference** | Same tool wiring pattern as **`get_people_by_space_slug`** (`packages/chat-server/src/tools/get-people-by-space-slug.ts`) |

---

## 1) Objective

Enable **Hypha AI** to answer:

- “What **documents / proposals / agreements** are in this space?”
- “**Search** for documents about X in this space.”
- “Who **created** this proposal?” (from `creator` on each item)

using a **server-side tool** backed by the **same SQL and access rules** as the MCP tool, without duplicating query logic in the chat route.

**Clarification:** Use **`get_people_by_space_slug`** for **membership / roster**. Use **`get_space_by_slug`** for **high-level stats** only. Use **`get_documents_by_space_slug`** for **per-document lists and fields**.

---

## 2) Parity with MCP and core

| Concern | Approach |
|---------|----------|
| **Single implementation** | Chat tool calls **`getDocumentsBySpaceSlug({ spaceSlug, page, pageSize, searchTerm, state }, { db, authToken })`** from `@hypha-platform/core/server`. |
| **Access** | Before core runs `checkSpaceAccessForSpace`, the chat tool mirrors **`get_people_by_space_slug`**: if `web3SpaceId` present, require valid token path via `checkSpaceAccessForSpace(host, authToken)`; return structured `{ found: false, error }` on denial. |
| **Slug hygiene** | Use **`sanitizeSlug`** from `system-prompt.ts` (same as other chat tools). |
| **Output** | Return the **core result object** directly (dates already ISO strings from `serializeDocumentsForToolJson`). |
| **Errors** | DB/RPC failures → `{ found: false, space_slug, error }` — **do not throw** into the model stream (match `get_people_by_space_slug`). |

---

## 3) Functional requirements

| ID | Requirement |
|----|----------------|
| **FR-C1** | Register tool **`get_documents_by_space_slug`** in **`createChatTools`** (`packages/chat-server/src/tools/index.ts`). |
| **FR-C2** | `inputSchema`: **`space_slug`**, **`page`**, **`page_size`**, optional **`searchTerm`**, optional **`state`**. |
| **FR-C3** | When request body includes **`spaceSlug`**, **`buildSystemPrompt`** SHALL tell the model to use **`get_documents_by_space_slug`** with that slug for document/proposal/list questions. |
| **FR-C4** | Tool description SHALL distinguish **documents** vs **members** vs **aggregate counts**. |
| **FR-C5** | Export **`createGetDocumentsBySpaceSlugTool`** from the tools package for apps that compose chat tools. |

---

## 4) Implementation map (completed)

1. **`packages/chat-server/src/tools/get-documents-by-space-slug.ts`** — `createGetDocumentsBySpaceSlugTool(authToken)`.
2. **`packages/chat-server/src/tools/index.ts`** — add to `createChatTools` return map.
3. **`packages/chat-server/src/system-prompt.ts`** — extend space-scoped prompt with a bullet for **`get_documents_by_space_slug`**.

---

## 5) Testing

| Test | Expected |
|------|----------|
| Manual | Authenticated chat with `spaceSlug` asks “list recent proposals”; model calls **`get_documents_by_space_slug`** with correct slug and optional **`state: "proposal"`**. |
| Access | Non-public space without token → tool returns **`error`** matching roster messaging. |

---

## 6) Follow-ups (optional)

- Add **`order`** parameter (reuse `PaginationParams` / `Order<Document>`) if product needs sort other than `createdAt DESC`.
- Extend payload with **token / voting** summaries per document in a separate tool to keep this read surface stable.

---

## 7) References

- MCP spec: `mcp-get-documents-by-space-slug-tech-spec.md`
- Epic: [#2027](https://github.com/hypha-dao/hypha-web/issues/2027)
