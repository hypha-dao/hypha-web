import { defaultMcpDeps } from '@hypha-platform/mcp-server/http/defaults';
import { getAuthServerConfig } from '../../../../(auth)/auth/_lib/server';
import { createMcpRoute } from '../../../../../lib/mcp/mcp-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** temp(mcp) #2559: protected-resource metadata (RFC 9728) of the MCP endpoint. Public. */
const route = createMcpRoute({
  getConfig: getAuthServerConfig,
  deps: () => defaultMcpDeps,
});

export const GET = route.metadata;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-max-age': '600',
    },
  });
}
