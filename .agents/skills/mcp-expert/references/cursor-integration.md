# Cursor MCP Integration

Cursor-specific behavior changes over time. Treat this file as patterns; verify against [Cursor MCP docs](https://docs.cursor.com/context/mcp).

## Configuration

- **Project:** `.cursor/mcp.json` — defines MCP servers (often `command`, `args`, `env`)
- **Plugins:** `.cursor-plugin/plugin.json` may declare `mcpServers` for bundled servers
- Prefer env vars for tokens; reference project-local env files that are gitignored

## CLI (when available)

Patterns referenced elsewhere in this repo’s Cursor role:

- List servers and status
- List tools for a server to inspect names and parameters before calling
- Enable/disable servers for isolation during debugging

Exact subcommands and flags: check current Cursor CLI documentation.

## Agent Tooling

- Hosts may expose MCP tools to the agent as callable tools with schema
- Read tool descriptors before invoking; validate arguments against schema
- Resources may map to fetch/read helpers separate from tools

## UX Expectations

- Users enable servers explicitly when sensitive
- Failures often surface as connection errors or missing capabilities — use [debugging.md](./debugging.md)
