# MCP Debugging

## 1. Server Not Listed or Not Connecting

- Validate JSON in `.cursor/mcp.json` (commas, quoting, correct command path)
- Run the server command manually with the same `env` the host would use
- On Windows vs Unix: path separators and shell wrapping issues

## 2. Handshake / Capability Failures

- Compare server’s advertised capabilities with what the host requests
- Check protocol version compatibility in init messages (SDKs usually handle this)

## 3. Tool Call Errors

- **Parse errors:** Usually invalid JSON or wrong types vs schema — compare payload to JSON Schema
- **Application errors:** Server returned `isError` or equivalent — read message and fix server or inputs
- **Timeouts:** Long work should use progress notifications if supported

## 4. Stdio Issues

- Accidental stdout logging breaks JSON stream — use stderr for logs
- Buffering: ensure line flushing on stdout when not using SDK

## 5. Remote / Auth Issues

- 401/403: token scope, clock skew, wrong base URL
- TLS: corporate proxies may require explicit configuration

## 6. Isolation

- Disable other MCP servers to rule out conflicts
- Reproduce with minimal tool set on the server
