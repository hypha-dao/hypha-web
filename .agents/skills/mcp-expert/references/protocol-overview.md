# MCP Protocol Overview

Concise reference for protocol primitives. For authoritative detail, use the published specification at [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io).

## Capabilities

Servers declare optional capability groups during initialization (e.g. tools, resources, prompts). Hosts must not assume a capability exists until negotiated.

## Tools

- Exposed with names and JSON Schema for arguments
- Invoked by the host on behalf of the model; results are structured content or errors
- Design tools to be idempotent when possible; document side effects in description

## Resources

- Identified by URI schemes the server defines or standard templates
- May support listing, reading, and subscriptions depending on capability
- Prefer stable URIs and clear MIME types when applicable

## Prompts

- Named prompt templates with arguments
- Often used for reusable instruction or context assembly (distinct from ad hoc user chat)

## Transports

- **Stdio:** Common for local servers; newline-delimited JSON-RPC messages
- **HTTP / SSE:** Remote servers; streaming and session semantics per spec revision

## Lifecycle

1. Connection and initialization
2. Capability exchange
3. Ongoing requests (tools/call, resources/read, etc.)
4. Shutdown — ensure subprocess cleanup for stdio servers

## Related Spec Topics

- Roots (filesystem/workspace hints from host)
- Sampling (server-initiated model requests when negotiated)
- Elicitation (structured user input flows)
- Progress notifications for long operations
