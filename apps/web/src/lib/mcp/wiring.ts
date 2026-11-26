import 'server-only';
import {
  loadAuthServerConfig,
  allowedScopesForResource,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';
import {
  getAbsoluteAppUrl,
  getMyMembership,
  getMyVote,
  getSpace,
  getSpaceDhoPath,
  listProposals,
  listQuests,
  listSignals,
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
  const as = (authServer ??= loadAuthServerConfig());
  const view: AuthServerView = as.enabled
    ? {
        enabled: true,
        issuer: as.issuer,
        resources: as.resources,
        allowedPersonIds: as.allowedPersonIds,
        scopesForResource: (resource) => allowedScopesForResource(resource, as),
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
    getSpace: (input, caller) => getSpace(input, caller, { db }),
    listProposals: (input, caller) => listProposals(input, caller, { db }),
    listSignals: (input, caller) => listSignals(input, caller, { db }),
    listQuests: (input, caller) => listQuests(input, caller, { db }),
    getMyVote: ({ spaceSlug, documentSlug }, caller) =>
      getMyVote({ spaceSlug, documentSlug, caller }, { db }),
    getMyMembership: ({ spaceSlug }, caller) =>
      getMyMembership({ spaceSlug, caller }, { db }),
  },
  spaceUrl: (slug) => getAbsoluteAppUrl(getSpaceDhoPath(slug, 'overview')),
  proposalUrl: (spaceSlug, proposalSlug) =>
    getAbsoluteAppUrl(
      getSpaceDhoPath(
        spaceSlug,
        `agreements/proposal/${encodeURIComponent(proposalSlug)}`,
      ),
    ),
  signalUrl: (spaceSlug, signalSlug) =>
    getAbsoluteAppUrl(
      `${getSpaceDhoPath(spaceSlug, 'coherence')}?signal=${encodeURIComponent(
        signalSlug,
      )}`,
    ),
  questUrl: (spaceSlug, questSlug) =>
    getAbsoluteAppUrl(
      getSpaceDhoPath(spaceSlug, `quests/${encodeURIComponent(questSlug)}`),
    ),
  slot,
});
