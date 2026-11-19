import 'server-only';
import {
  loadAuthServerConfig,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';
import {
  getAbsoluteAppUrl,
  getMyMembership,
  getSpaceDhoPath,
  listSpaces,
  resolveCaller,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { createRateSlot } from '../authorize-request';
import { loadMcpConfig, type AuthServerView } from './config';
import { createMcpRequestHandlers } from './request-handler';

/**
 * The one place that wires the hosted MCP server into the app: configuration, the database,
 * the feature functions and the real links. Route files import the handlers from here.
 */
let authServer: AuthServerConfig | AuthServerDisabled | undefined;
let mcpConfig: ReturnType<typeof loadMcpConfig> | undefined;

function getMcpConfig() {
  authServer ??= loadAuthServerConfig();
  const view: AuthServerView = authServer.enabled
    ? {
        enabled: true,
        issuer: authServer.issuer,
        resources: authServer.resources,
        allowedPersonIds: authServer.allowedPersonIds,
      }
    : { enabled: false };
  return (mcpConfig ??= loadMcpConfig(process.env, view));
}

// A coarse per-instance safety net; the platform firewall rule is the real flood control.
const slot = createRateSlot({ limit: 120, windowMs: 60_000 });

export const mcpHandlers = createMcpRequestHandlers({
  getConfig: getMcpConfig,
  resolve: (claims) => resolveCaller(claims, { db }),
  features: {
    listSpaces: (input, caller) => listSpaces(input, caller, { db }),
    getMyMembership: ({ spaceSlug }, caller) =>
      getMyMembership({ spaceSlug, caller }, { db }),
  },
  spaceUrl: (slug) => getAbsoluteAppUrl(getSpaceDhoPath(slug, 'overview')),
  slot,
});
