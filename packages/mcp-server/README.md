# `@hypha-platform/mcp-server`

Stdio [Model Context Protocol](https://modelcontextprotocol.io) server exposing Hypha read tools (e.g. `get_people_by_space_slug`, `get_org_memory_by_space_slug`, `get_documents_by_space_slug`). Spec: `docs/requirements/mcp-get-org-memory-by-space-slug-tech-spec.md`.

## Security and access control

`get_people_by_space_slug`, **`get_org_memory_by_space_slug`**, and **`get_documents_by_space_slug`** call **`checkSpaceAccessForSpace`** in `@hypha-platform/core/server` (same transparency / membership rules as the web app) when the space exists in the database and has a **`web3SpaceId`**. Provide a **Privy JWT** (same kind the web client sends) via:

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

## Tools

| Tool                       | Description                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `get_people_by_space_slug` | Members of a space by slug (people + space-as-members), aligned with `getSpaceMembersRoster` in `@hypha-platform/core`. |
| `get_documents_by_space_slug` | Documents in a space by slug (DB `documents` + creator), paginated search/filter; uses `getDocumentsBySpaceSlug` in `@hypha-platform/core`. |
| `get_org_memory_by_space_slug` | Org memory: roster + `org_memory_assets` (proposal attachments from documents; Matrix chat files when `HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN` + `NEXT_PUBLIC_MATRIX_HOMESERVER_URL` are set). Optional `assets_page`, `assets_page_size`, `assets_search`. |
