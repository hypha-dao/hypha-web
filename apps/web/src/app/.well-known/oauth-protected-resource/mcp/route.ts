import { mcpHandlers } from '../../../../lib/mcp/wiring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Protected-resource metadata (RFC 9728) of the hosted MCP server: the issuer and the scopes.
export const GET = mcpHandlers.metadata;
