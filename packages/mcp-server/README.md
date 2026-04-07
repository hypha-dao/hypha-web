# `@hypha-platform/mcp-server`

Stdio [Model Context Protocol](https://modelcontextprotocol.io) server exposing Hypha read tools (e.g. `get_people_by_space_slug`).

## Security and access control

`get_people_by_space_slug` calls **`checkSpaceAccessForSpace`** in `@hypha-platform/core/server` (same transparency / membership rules as the web app) when the space exists in the database. Provide a **Privy JWT** (same kind the web client sends) via:

- **`HYPHA_MCP_AUTH_TOKEN`** — bearer token used to resolve the caller’s identity for non-public spaces.

Without a token, **non-public** spaces return an access error. Public spaces still work without a token.

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
