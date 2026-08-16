import {
  resolveCanonicalSourceApp,
  type ResolveCanonicalSourceAppResult,
} from '@hypha-platform/core/intelligence';

export const MCP_INTELLIGENCE_SOURCE_APP_FALLBACK = 'hypha-mcp';

/** Server-assigned source_app for MCP intelligence writes. */
export function resolveMcpSourceApp(
  claimed?: string,
): ResolveCanonicalSourceAppResult {
  return resolveCanonicalSourceApp({
    claimed,
    configured: process.env.HYPHA_MCP_SOURCE_APP?.trim() || undefined,
    fallback: MCP_INTELLIGENCE_SOURCE_APP_FALLBACK,
  });
}

export function mcpAuthToken(): string | undefined {
  return process.env.HYPHA_MCP_AUTH_TOKEN;
}
