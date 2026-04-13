# Space Memory panel (Coherence)

This plan ties the **Space Memory** surface (Coherence) to shared backend projections. Detailed UI milestones may live in other coherence docs; this file anchors **cross-cutting contracts** referenced by architecture and requirements.

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
