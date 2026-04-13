# Space Memory panel (Coherence)

This plan ties the **Space Memory** surface (Coherence) to shared backend projections. Detailed UI milestones may live in other coherence docs; this file anchors **cross-cutting contracts** referenced by architecture and requirements.

---

## 1) Phased delivery — panel, MCP, and Matrix assets

Space Memory should eventually show **one combined view**: **governance attachments** (from `documents`) **and** **Matrix chat media** (`m.file` / `m.image`, `mxc://`). Those bytes live in different stores ([documents-and-media-overview §4](../architecture/documents-and-media-overview.md)); the **org memory catalogue** is the single index both the **panel** and **`get_org_memory_by_space_slug`** consume.

| Step | What ships | Outcome for the panel | Outcome for MCP / Chat |
|------|--------------|------------------------|-------------------------|
| **1** | Space Memory lists **proposal / governance** files | User sees **upload / CDN URLs** tied to `documents` (same attachment model as today’s agreements flow). Typically backed by existing document APIs or by aggregating **`get_documents_by_space_slug`** (paginate until `has_next_page` is false) when the consumer is an assistant. | **`get_documents_by_space_slug`** remains the contract for SQL **documents** + **`attachments`** / **`leadImage`**. |
| **2** | **`get_org_memory_by_space_slug`** (MCP + Hypha Chat) **v1** | Panel **may** still use document APIs only for files; roster is optional in the panel UI. **No Matrix-only rows yet** in MCP (`org_memory_assets` is **`[]`**). | Roster + empty **`org_memory_assets`**. Spec: [mcp-get-org-memory-by-space-slug-tech-spec.md](../requirements/mcp-get-org-memory-by-space-slug-tech-spec.md). |
| **3** | **Org memory catalogue** + **`org_memory_assets`** + panel merge | Panel shows **both** governance attachments **and** **Matrix-backed assets** in one list (or grouped tabs), with icons/type from `source`, thumbnails where the UI can resolve **`mxc_uri`** for the signed-in user, and the same **access** rules as the space. | **`get_org_memory_by_space_slug`** returns **non-empty** **`org_memory_assets`** (rows per [mcp-get-documents-by-space-slug-tech-spec.md §8.1](../requirements/mcp-get-documents-by-space-slug-tech-spec.md#81-unified-listing-target)). Assistants use **one tool** for the unified asset index **plus** members; they still use **`get_documents_by_space_slug`** when they need **full document rows** (state, creator, voting status). |

### Step 3 — implementation checklist (ready for tickets)

1. **Catalogue (blocking)** — Schema + upsert for **`source = matrix_chat`** from the space room timeline ([architecture §4.2](../architecture/documents-and-media-overview.md#42-ingestion-path-a--matrix-chat-mfile--mimage)) and for **`proposal_upload`** / document-linked rows ([§4.3](../architecture/documents-and-media-overview.md#43-ingestion-path-b--proposals--uploads-existing-pipeline)). Reuse **real `matrix_room_id`** (`!…:server`); ingestion worker may use **`matrix-js-sdk@^40`** server-side where applicable.
2. **Core read API** — Typed **`getOrgMemoryBySpaceSlug`** (name illustrative) that returns **`{ members, org_memory_assets, pagination … }`** from one place: delegate **`members`** to **`getSpaceMembersRoster`**, **`org_memory_assets`** to catalogue queries filtered by **`space_id` / `organisation_id`**, with the same **`checkSpaceAccessForSpace`** gating as MCP roster/documents tools.
3. **MCP** — Relax **v1-only empty** constraint on **`org_memory_assets`**; add **Zod `orgMemoryAssetSchema`**, optional **`page` / `page_size`** for an **assets** slice if the merged list is large (follow-up FR in the MCP spec — default: same pagination model as documents tool or cursor-based; document choice in the spec amendment).
4. **Hypha app (Space Memory panel)** — Server component or route handler calls the **same core read** as MCP (not a second query shape). UI: merge or section **“From proposals”** vs **“From chat”** using **`source`**; for **`mxc_uri`**, use the **existing** Matrix media URL path the chat panel uses (authenticated / unauthenticated per homeserver policy — see [§9.2](#92-urls-fetch-and-matrix-mxc) and Matrix E2EE notes in [§9.3](#93-matrix-sdk-and-e2ee)).
5. **Chat AI** — Extend **`createGetOrgMemoryBySpaceSlugTool`** return shape with populated **`org_memory_assets`**; update **`buildSystemPrompt`** so the model prefers this tool for “everything the space remembers” including **chat files**, and **`get_documents_by_space_slug`** for governance **workflow** questions.

**Traceability:** Epic [#2027](https://github.com/hypha-dao/hypha-web/issues/2027) (MCP); org memory architecture [documents-and-media-overview §4–§4.7](../architecture/documents-and-media-overview.md#4-organisation-memory--how-all-documents-matrix--upload-can-work).

---

## 9) MCP and Hypha Chat AI

**Goal:** MCP hosts and Hypha Chat read the **same logical org memory** as the product: members (and future catalogued assets) under the same access rules as the web app.

### 9.1 Tools

| Tool | Role |
|------|------|
| `get_documents_by_space_slug` | PostgreSQL **`documents`** rows + **`attachments`** / **`leadImage`** (upload / CDN URLs). See [mcp-get-documents-by-space-slug-tech-spec.md](../requirements/mcp-get-documents-by-space-slug-tech-spec.md). |
| `get_people_by_space_slug` | On-chain roster + DB **`memberships`** for people + space-type members. See [mcp-get-people-by-space-slug-tech-spec.md](../requirements/mcp-get-people-by-space-slug-tech-spec.md). |
| **`get_org_memory_by_space_slug`** | **Org memory umbrella:** **v1** = same roster as **`get_people_by_space_slug`** + **`org_memory_assets: []`**; later = catalogue rows. See [mcp-get-org-memory-by-space-slug-tech-spec.md](../requirements/mcp-get-org-memory-by-space-slug-tech-spec.md) and [chat-ai-get-org-memory-by-space-slug-integration.md](../requirements/chat-ai-get-org-memory-by-space-slug-integration.md). |

### 9.2 URLs, fetch, and Matrix (`mxc`)

| Kind | AI / host behaviour |
|------|---------------------|
| **Public or long-lived signed HTTPS** | Model may use host **`web_fetch`** or multimodal inputs. |
| **Session- or cookie-gated** | Anonymous fetch may fail; prefer server-side authenticated fetch or **indexed excerpts** in org memory. |
| **`mxc://` (Matrix)** | Not exposed until catalogue + server-side resolution; never assume browser-only media URL helpers for MCP. |

### 9.3 Matrix SDK and E2EE

- Use **real room IDs** (`!…:server`) in any catalogue row, not aliases.
- **E2EE rooms:** org memory for encrypted attachments may require **client-assisted** registration; tools MUST NOT leak media the caller cannot decrypt.

### 9.4 MCP design reference

For protocol patterns (schemas, `structuredContent`, secrets), see the MCP expert skill: [`.agents/skills/mcp-expert/SKILL.md`](../../.agents/skills/mcp-expert/SKILL.md) (path relative to repo root from `docs/plans/`: `../../.agents/skills/mcp-expert/SKILL.md`).
