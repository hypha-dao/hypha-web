# `@hypha-platform/mcp-server`

Stdio [Model Context Protocol](https://modelcontextprotocol.io) server exposing Hypha read tools (e.g. `get_people_by_space_slug`).

## Security and access control

This process uses the same **database** connection as other server code (`@hypha-platform/storage-postgres`) but does **not** replicate the **web app’s** per-request checks (`checkSpaceAccess` on `GET /api/v1/spaces/.../members` and the chat route). Treat it as **operator / trusted-environment** tooling: run only with credentials and network access you intend the MCP host to use.

For **end-user parity** with in-app transparency rules, use the **authenticated web APIs** or extend this server with explicit auth before production exposure.

## Configuration

Set the same environment variables required for DB and RPC access as the rest of the monorepo (e.g. `DEFAULT_DB_URL` or Neon/Postgres URLs, `NEXT_PUBLIC_RPC_URL` where `publicClient` reads the chain).

## Run locally

From the repo root:

```bash
pnpm --filter @hypha-platform/mcp-server start
```

Add the server to your MCP host (e.g. Cursor **Settings → MCP** or `.cursor/mcp.json`) with `command`/`args` pointing at the script above and the required `env`.

## Tools

| Tool | Description |
|------|-------------|
| `get_people_by_space_slug` | Members of a space by slug (people + space-as-members), aligned with `getSpaceMembersRoster` in `@hypha-platform/core`. |
