---
name: hypha-web-mcp
description: Uses the local hypha-web MCP server to fetch and summarize Hypha space context by slug. Use when the user asks to query space data, run get_space_by_slug, verify MCP connectivity, or produce structured summaries of a Hypha space.
---

# Hypha Web MCP

Use this skill to query Hypha space data through the local MCP endpoint and present clean, grounded summaries.

## Scope

- Query one space by slug via `get_space_by_slug`
- Validate MCP connectivity for local development
- Render returned structured data in a human-friendly format
- Diagnose common local MCP setup issues

## Preconditions

Before any MCP call:

1. Confirm app is running locally (`pnpm dev` in repo root)
2. Confirm Cursor MCP config includes:
   - `hypha-web-mcp` -> `http://localhost:3000/mcp`
3. Treat `/mcp` as protocol endpoint (not a browser page)

## Primary Workflow

Copy this checklist and update progress:

```txt
Hypha MCP Workflow
- [ ] Verify endpoint reachability
- [ ] Call get_space_by_slug
- [ ] Validate found/not found
- [ ] Present structured summary
```

### 1) Verify endpoint reachability

- Prefer MCP client usage (Cursor tools).
- If debugging manually, initialize over JSON-RPC and check server info is returned.

### 2) Call tool

- Tool: `get_space_by_slug`
- Arguments:
  - `slug` (string, required)

### 3) Validate response

- If `structuredContent.found` is `true`, use `structuredContent.space`.
- If `false`, report clearly that slug was not found.
- If `isError` is `true`, diagnose with troubleshooting section.

### 4) Present output

When user asks for "actual data", return raw JSON.
When user asks for "properly rendered", use this format:

- **Title**: `space.title`
- **Identity**: `id`, `slug`, `web3SpaceId`
- **Hierarchy**: `parentId`, `subspaceCount`
- **Activity signals**: `memberCount`, `documentCount`
- **Description**: verbatim, unedited
- **Timestamps**: `createdAt`, `updatedAt`

## Response Templates

### Data-first template

```markdown
## <title> Space
- ID: `<id>`
- Slug: `<slug>`
- Web3 Space ID: `<web3SpaceId>`
- Parent ID: `<parentId>`
- Member Count: `<memberCount>`
- Document Count: `<documentCount>`
- Subspace Count: `<subspaceCount>`
- Created At: `<createdAt>`
- Updated At: `<updatedAt>`

<description>
```

### Not found template

```markdown
No space found for slug `<slug>`.
```

## Troubleshooting

### `ECONNREFUSED localhost:3000`

- Dev server not running or wrong port.
- Start/restart `pnpm dev` and re-test.

### MCP says auth required

- Usually a transport or server error surfaced as generic auth.
- Check `/mcp` initialize call and server logs before adding auth.

### `Module not found: zod/v3`

- MCP SDK and zod version mismatch.
- Ensure workspace uses compatible `zod` (>= 3.25).

### `/mcp` opens with browser/devtools errors

- Expected if treated as page navigation.
- Use MCP client calls, not browser page rendering.

## Guardrails

- Do not invent fields not returned by MCP.
- Keep summaries grounded in returned JSON.
- If counts are zero or look surprising, report them as-is and call out uncertainty.
- Prefer concise output unless user asks for detailed analysis.
