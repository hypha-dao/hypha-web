import { defaultMcpDeps } from '@hypha-platform/mcp-server/http/defaults';
import { getAuthServerConfig } from '../../(auth)/auth/_lib/server';
import { createMcpRoute } from '../../../lib/mcp/mcp-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * temp(mcp) #2559: remote MCP endpoint for tokens of our authorization server (#2608). Exists
 * only when `<origin>/api/mcp` is listed in AUTH_SERVER_RESOURCES.
 */
const route = createMcpRoute({
  getConfig: getAuthServerConfig,
  deps: () => defaultMcpDeps,
});

export const POST = route.POST;
export const GET = route.GET;
export const DELETE = route.DELETE;
