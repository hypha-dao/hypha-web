# MCP Server Authoring

## SDKs

- Official SDKs (e.g. TypeScript `@modelcontextprotocol/sdk`) implement message framing, capability negotiation, and typed handlers
- Prefer SDK primitives over raw JSON-RPC to reduce protocol drift

## Stdio Servers

- Read/write newline-delimited JSON-RPC on stdin/stdout
- Log diagnostics to stderr to avoid corrupting the protocol stream
- Exit cleanly on SIGTERM; avoid orphan processes when the host disconnects

## Remote Servers

- HTTP/SSE or streamable HTTP patterns per current spec
- Implement health checks and auth (OAuth, API keys) appropriate to deployment

## Tool Design

- **Schema-first:** Accurate JSON Schema reduces model errors and injection surprises
- **Narrow surface:** Fewer, well-named tools beat many overlapping ones
- **Errors:** Return structured errors the model can interpret and retry when appropriate

## Testing

- Unit-test tool handlers with representative inputs and schema edge cases
- Integration-test against a minimal host or MCP inspector tools when available

## References

- [Protocol overview](./protocol-overview.md) for capability flags
- [Security](./security.md) before shipping servers to a team
