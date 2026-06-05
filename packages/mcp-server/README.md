# `@hypha-platform/mcp-server`

Stdio [Model Context Protocol](https://modelcontextprotocol.io) server exposing Hypha read tools (e.g. `get_people_by_space_slug`, `get_org_memory_by_space_slug`, `fetch_org_memory_asset`, `get_documents_by_space_slug`). Spec: `docs/requirements/mcp-get-org-memory-by-space-slug-tech-spec.md`.

## Security and access control

`get_people_by_space_slug`, **`get_org_memory_by_space_slug`**, **`fetch_org_memory_asset`**, and **`get_documents_by_space_slug`** call **`checkSpaceAccessForSpace`** in `@hypha-platform/core/server` (same transparency / membership rules as the web app) when the space exists in the database and has a **`web3SpaceId`**. Provide a **Privy JWT** (same kind the web client sends) via:

- **`HYPHA_MCP_AUTH_TOKEN`** — bearer token used to resolve the caller’s identity for non-public spaces.

Without a token, **non-public** spaces return an access error. Public spaces still work without a token.

## TypeScript

`tsconfig.json` extends the shared Next.js preset so `tsc --noEmit` matches other packages and stays consistent with how workspace packages resolve `@hypha-platform/core`.

**Why not `module: NodeNext` / `moduleResolution: NodeNext` here?** For a standalone Node ESM binary, that would align `tsc` import rules with `node --import tsx`. In this monorepo, turning that on for `mcp-server` alone makes TypeScript resolve `@hypha-platform/core/server` into `packages/core` with Node16/NodeNext extension rules that those sources do not satisfy today, so `tsc` fails while `tsx` still runs. We keep the Next preset until core exports are NodeNext-friendly (or this package stops depending on core via path mapping in a way that triggers those rules).

For stdio scripts that use `process` globals, ensure the compiler includes Node typings (e.g. `"types": ["node"]` in `compilerOptions`, or rely on a preset that already pulls them in).

## Configuration

Set the same environment variables required for DB and RPC access as the rest of the monorepo (e.g. `DEFAULT_DB_URL` or Neon/Postgres URLs, `NEXT_PUBLIC_RPC_URL` where `publicClient` reads the chain). For roster tools on restricted spaces, set **`HYPHA_MCP_AUTH_TOKEN`**.

For **Matrix-backed** rows in `org_memory_assets`, prefer **`HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN`** (a normal Matrix **access token** for a user joined to the space chat room — *not* a Privy JWT) plus **`NEXT_PUBLIC_MATRIX_HOMESERVER_URL`**. Alternatively, with **`HYPHA_MCP_AUTH_TOKEN`** (Privy JWT) set, you can set **`HYPHA_MCP_MATRIX_REQUEST_URL`** to a full deployment URL (same host shape as the web app, e.g. `https://your-app.vercel.app`) so org memory can resolve the **caller's** Matrix token from `matrix_user_links` (parity with Human Chat). If unset on Vercel, **`VERCEL_URL`** is used as `https://$VERCEL_URL`. The server calls `GET /_matrix/client/v3/rooms/{roomId}/messages` with `access_token` as a query parameter (Synapse-compatible). Ensure the space has **`chat_room_id`** set in the database. Tool output includes **`matrix_fetch`** (including `used_session_matrix_token`, `session_matrix_token_unavailable`, HTTP status, event counts, skip reason) when Matrix rows are empty. Without Matrix configuration, proposal-backed assets still appear; Matrix assets are omitted.

## Run locally

From the repo root:

```bash
pnpm --filter @hypha-platform/mcp-server start
```

Add the server to your MCP host (e.g. Cursor **Settings → MCP** or `.cursor/mcp.json`) with `command`/`args` pointing at the script above and the required `env`.

## Tools (complete MCP server list)

| Tool | Description |
| --- | --- |
| `summarize_space_discussion_by_slug` | Create and persist a summary of recent Matrix chat discussion for a space slug. |
| `ingest_space_call_artifacts` | Persist call recording/transcript artifacts for a space call session. |
| `create_space_signal_by_slug` | Create a signal in a space (write-capable; limited to active paid spaces). |
| `relay_ecosystem_signal` | Relay a summarized signal from one ecosystem space to another (write-capable). |
| `get_ecosystem_by_space_slug` | Return interconnected ecosystem context (spaces graph and parent-child links). |
| `get_people_by_space_slug` | Members by space slug (people + space-as-members), with membership/join metadata. |
| `get_org_memory_by_space_slug` | Organization memory (member roster + org memory assets with asset keys). |
| `fetch_org_memory_asset` | Fetch one memory asset by `space_slug` + `asset_key` (text/PDF/image/video modes). |
| `get_token_holdings_by_space_slug` | Token holdings/treasury distribution for a space by slug. |
| `get_documents_by_space_slug` | Paginated documents/proposals/agreements list with optional filters. |

### Notes

- The list above is the MCP server inventory registered in `packages/mcp-server/src/main.ts`.
- AI chat also uses a tool layer in `packages/chat-server/src/tools/index.ts`; that layer includes `get_space_by_slug` and `web_search` for chat orchestration, which are not currently exposed by the MCP server binary.
