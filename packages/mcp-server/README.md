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
| `get_org_memory_by_space_slug` | Org memory projection: **v1** same roster as `get_people_by_space_slug` plus `org_memory_assets: []` until the catalogue exists. |
