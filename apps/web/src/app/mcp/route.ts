import { mcpHandlers } from '../../lib/mcp/wiring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Hosted MCP server (#2610). Answers only on its own host (404 elsewhere), off unless
// MCP_SERVER_ENABLED is "true". Every response carries the response headers (K20): methods are
// exported through the handler wrapper and this file builds no response itself.
export const GET = mcpHandlers.mcp;
export const POST = mcpHandlers.mcp;
export const DELETE = mcpHandlers.mcp;
