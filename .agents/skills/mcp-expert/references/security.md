# MCP Security

## Trust Model

- MCP servers can run arbitrary code and access credentials in their environment
- Treat every server as **trusted only to the degree its source and maintainer warrant**
- Prefer official or audited servers for production workspaces

## Secrets

- Pass tokens via environment variables or host secret stores — **never** hardcode in `mcp.json` committed to git
- Use separate API keys per server with minimal scopes
- Rotate keys if a server or repo was exposed

## Data Exfiltration

- Tools may send data to external APIs — review what each tool does before enabling in confidential projects
- Remote transports add network exposure — TLS, pinning, and egress policies matter

## Host Sandbox

- Understand Cursor/agent sandbox modes: network and filesystem restrictions may block legitimate server behavior or vice versa
- Document when a server needs `full_network` or elevated permissions

## Supply Chain

- Pin server versions (package lockfiles, exact Docker tags)
- Review updates to MCP servers with the same rigor as application dependencies
