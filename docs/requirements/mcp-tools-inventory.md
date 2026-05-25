# MCP Tools Inventory — Hypha

## Document control

| Field | Value |
|---|---|
| **Status** | Active |
| **Source of truth** | `packages/mcp-server/src/main.ts` |
| **Purpose** | Canonical inventory of MCP tools available to agents/integrations |

---

## 1) Complete MCP tool list (server-registered)

The `@hypha-platform/mcp-server` currently registers the following tools:

1. `summarize_space_discussion_by_slug`
2. `ingest_space_call_artifacts`
3. `create_space_signal_by_slug`
4. `relay_ecosystem_signal`
5. `get_ecosystem_by_space_slug`
6. `get_people_by_space_slug`
7. `get_org_memory_by_space_slug`
8. `fetch_org_memory_asset`
9. `get_token_holdings_by_space_slug`
10. `get_documents_by_space_slug`

---

## 2) Capability map

| Domain | Tool(s) |
|---|---|
| Members / roster | `get_people_by_space_slug` |
| Documents / proposals / agreements | `get_documents_by_space_slug` |
| Treasury / token holdings | `get_token_holdings_by_space_slug` |
| Space memory / org memory | `get_org_memory_by_space_slug`, `fetch_org_memory_asset` |
| Discussion summaries | `summarize_space_discussion_by_slug` |
| Call recordings/transcripts ingestion | `ingest_space_call_artifacts` |
| Ecosystem topology/context | `get_ecosystem_by_space_slug` |
| Signals (create/relay) | `create_space_signal_by_slug`, `relay_ecosystem_signal` |

---

## 3) Scope note (MCP vs AI chat tool layer)

- This document covers the MCP server tool inventory only.
- AI chat uses a separate tool layer in `packages/chat-server/src/tools/index.ts`.
- The AI chat layer includes additional tools (e.g. `get_space_by_slug`, `web_search`) used by chat orchestration and prompt policy.

---

## 4) Requirement statement

- **FR-1** The system SHALL maintain this inventory in sync with MCP tool registration in `packages/mcp-server/src/main.ts`.
- **FR-2** The system SHALL update this inventory whenever MCP tools are added, removed, or renamed.
- **AC-1** Given a change to `server.registerTool(...)`, when the PR is prepared, then this inventory reflects the exact final tool names.

