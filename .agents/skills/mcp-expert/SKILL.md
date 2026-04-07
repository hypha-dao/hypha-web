---
name: mcp-expert
description: Model Context Protocol (MCP) architecture, server design, Cursor integration, security, and debugging. Use when developers ask about MCP servers, tools/resources/prompts, stdio or remote transports, mcp.json, OAuth, or troubleshooting agent-to-server connectivity.
---

# MCP Expert

Expert workflow for the **Model Context Protocol (MCP)** — how hosts connect to servers, expose capabilities to LLMs, and integrate with Cursor.

**Mandatory:** For protocol semantics, transports, and SDK behavior, prefer current docs at [modelcontextprotocol.io](https://modelcontextprotocol.io) and the [specification](https://spec.modelcontextprotocol.io). For Cursor-specific wiring (`mcp.json`, CLI), prefer [Cursor MCP documentation](https://docs.cursor.com/context/mcp) (also `https://cursor.com/docs`). Protocol and product surfaces change — verify assumptions before giving version-specific answers.

**Load references only when the task matches that section.** Do not load all references for every question.

## When to Use

- Designing, configuring, or debugging MCP servers (stdio, HTTP/SSE, remote)
- Explaining tools vs resources vs prompts, sampling, roots, or elicitation
- Editing `.cursor/mcp.json`, plugin MCP entries, or environment for servers
- Security review of MCP integrations (secrets, scopes, sandbox, trust boundaries)
- Interpreting errors from MCP handshake, JSON-RPC, or transport layers

## Quick Mental Model

| Piece | Role |
|-------|------|
| **Host** | IDE or agent runtime that launches or connects to servers and forwards requests |
| **Server** | Process or service implementing MCP; advertises capabilities |
| **Tools** | Callable actions with schemas (model-invoked) |
| **Resources** | Addressable content (often URIs); read/subscribe patterns |
| **Prompts** | Named templates the host may surface to the user/model |

See [Protocol overview](./references/protocol-overview.md) for primitives and lifecycle detail.

## Cursor & Hypha-Web Integration

- Project config: `.cursor/mcp.json` (command/args/env per server entry)
- Inspect tooling: Cursor CLI MCP commands where available (`agent mcp list`, list-tools) — see [Cursor integration](./references/cursor-integration.md)
- Prefer least-privilege env vars; never commit secrets — see [Security](./references/security.md)

## Server Authoring

- Official SDKs (TypeScript, Python, etc.), stdio vs remote deployment, capability negotiation — [Server authoring](./references/server-authoring.md)

## Debugging Checklist

1. Confirm server binary/path and required env vars on the host machine
2. Run server standalone; verify it speaks MCP (stdio line-delimited JSON-RPC or correct HTTP/SSE)
3. Check host logs for connection, capability handshake, and tool schema errors
4. Validate tool input against JSON Schema the server advertised
5. For remote servers: auth (OAuth/API keys), TLS, CORS, and network allowlists

Details: [Debugging](./references/debugging.md)

## References

| Topic | File |
|-------|------|
| Primitives, transports, capability negotiation | [protocol-overview.md](./references/protocol-overview.md) |
| Cursor `mcp.json`, CLI, plugins | [cursor-integration.md](./references/cursor-integration.md) |
| Secrets, trust, sandboxing | [security.md](./references/security.md) |
| SDKs, implementation patterns | [server-authoring.md](./references/server-authoring.md) |
| Systematic troubleshooting | [debugging.md](./references/debugging.md) |
