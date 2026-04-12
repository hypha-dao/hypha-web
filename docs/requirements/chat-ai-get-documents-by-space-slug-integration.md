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
- “What **files** (PDFs, images, videos) are **attached** to those documents?” (from **`attachments`** and **`leadImage`** on each row — same payload as MCP)
- “Which proposals are **on voting** vs **accepted**?” — use each item’s **`status`** when **`source_chain`** is **`"rpc"`** (on-chain proposal lists); **`state`** remains the DB workflow enum (`discussion` / `proposal` / `agreement`).

using a **server-side tool** backed by the **same SQL and access rules** as the MCP tool, without duplicating query logic in the chat route.

**Clarification:** Use **`get_people_by_space_slug`** for **membership / roster**. Use **`get_space_by_slug`** for **high-level stats** only. Use **`get_documents_by_space_slug`** for **per-document lists and fields** (including **embedded upload URLs**).

**Org memory:** Matrix-only chat attachments (`mxc://`) are **not** in this tool until an **org memory catalogue** exists ([architecture §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work), [§4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai)). The Chat **system prompt** SHOULD tell the model: after listing documents, it may **`web_fetch`** (or use host multimodal) on **HTTPS** URLs from `attachments` / `leadImage` **if** URLs are reachable; for **private** blobs, rely on future **authenticated fetch** or **indexed excerpts** — see MCP spec **§8.2**.

---

## 2) Parity with MCP and core

| Concern | Approach |
|---------|----------|
| **Single implementation** | Chat tool calls **`getDocumentsBySpaceSlug({ spaceSlug, page, pageSize, searchTerm, state }, { db, authToken })`** from `@hypha-platform/core/server`. |
| **Access** | **`getDocumentsBySpaceSlug`** applies **`checkSpaceAccessForSpace`** when the space has **`web3SpaceId`**; the chat tool delegates only (no duplicate gating). |
| **Slug hygiene** | Use **`sanitizeSlug`** from `system-prompt.ts` (same as other chat tools). |
| **Output** | Return the **core result object** directly (dates already ISO strings; includes **`source_chain`** and per-document **`status`** when chain data is available — same semantics as the space documents UI). |
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
| **FR-C6** | **`buildSystemPrompt`** (space-scoped) SHALL instruct the model to **paginate through all pages** of **`get_documents_by_space_slug`** when the user asks for **every attachment** in the space (merge results until `has_next_page` is false). |
| **FR-C7** | System prompt SHALL state that **`attachments`** / **`leadImage`** may point to **binary** content; the model SHOULD fetch via host **`web_fetch`** / multimodal when URLs are public or signed, and MUST NOT assume **`mxc://`** URIs appear in this tool (Matrix path = catalogue follow-up). |

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
- Extend payload with **token / vote tallies** per document in a separate tool if needed beyond **`status`** (accepted / rejected / onVoting).
- **Org memory catalogue:** extend MCP + Chat with **`org_memory_assets`** or **`get_org_memory_by_space_slug`** per MCP spec **§8.1** so **Matrix + uploads** appear in one surface for AI.

---

## 7) References

- MCP spec: `mcp-get-documents-by-space-slug-tech-spec.md` (includes **§8** org memory roadmap for MCP)
- Architecture: [documents-and-media-overview.md §4](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work), [§4.7](../architecture/documents-and-media-overview.md#47-mcp-and-hypha-chat-ai)
- Space Memory UI + MCP notes: [space-memory-panel.md](../plans/space-memory-panel.md) §9
- Epic: [#2027](https://github.com/hypha-dao/hypha-web/issues/2027)
- Org memory docs PR: [#2138](https://github.com/hypha-dao/hypha-web/pull/2138)
