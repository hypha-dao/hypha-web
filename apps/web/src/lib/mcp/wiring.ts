import 'server-only';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { checkRateLimit } from '@vercel/firewall';
import {
  loadAuthServerConfig,
  allowedScopesForResource,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';
import {
  createSignal,
  failure,
  getAbsoluteAppUrl,
  getMyMembership,
  getMyVote,
  getSpace,
  getSpaceDhoPath,
  listProposals,
  listQuests,
  listSignals,
  listSpaces,
  mcpClientOrigin,
  resolveCaller,
  type WriteRateLimiter,
} from '@hypha-platform/core/server';
import { createRateSlot } from '../authorize-request';
import {
  createFirewallWriteRateLimiter,
  signalCreateWindows,
} from '../write-rate-limit';
import { loadMcpConfig, type AuthServerView } from './config';
import { createMcpRequestHandlers } from './request-handler';

/**
 * The one place that wires the hosted MCP server into the app: configuration, the feature
 * functions with the caller's context, and the real links. Route files import the handlers from
 * here. No database handle passes through: features reach data through the data-access boundary.
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
        writesEnabled: as.mcpWritesEnabled,
      }
    : { enabled: false };
  return (mcpConfig ??= loadMcpConfig(process.env, view));
}

// A coarse per-instance safety net; the platform firewall rule is the real flood control.
const slot = createRateSlot({ limit: 120, windowMs: 60_000 });

// Writes have their own, much tighter budget per person (#2744): firewall rules where configured
// in production, else in memory per instance. Built on first use, so the environment is read at
// run time.
let signalCreateLimiter: WriteRateLimiter | undefined;
function getSignalCreateLimiter(): WriteRateLimiter {
  return (signalCreateLimiter ??= createFirewallWriteRateLimiter(
    signalCreateWindows(process.env),
    {
      check: checkRateLimit,
      requestHeaders: headers,
      production: process.env.NODE_ENV === 'production',
    },
  ));
}

export const mcpHandlers = createMcpRequestHandlers({
  getConfig: getMcpConfig,
  resolve: (claims) => resolveCaller(claims),
  features: {
    listSpaces: (input, caller) => listSpaces(input, { actor: caller }),
    getSpace: (input, caller) => getSpace(input, { actor: caller }),
    listProposals: (input, caller) => listProposals(input, { actor: caller }),
    listSignals: (input, caller) => listSignals(input, { actor: caller }),
    listQuests: (input, caller) => listQuests(input, { actor: caller }),
    getMyVote: ({ spaceSlug, documentSlug }, caller) =>
      getMyVote({ spaceSlug, documentSlug }, { actor: caller }),
    getMyMembership: ({ spaceSlug }, caller) =>
      getMyMembership({ spaceSlug }, { actor: caller }),
    createSignal: async (input, caller) => {
      // The edge names the path: an AI client through the authorization server. A write is
      // always attributed to a client; a token without one is refused, as the feature does.
      const clientId = caller.via?.clientId?.trim();
      if (!clientId) {
        return failure('forbidden', 'This app was not allowed to write.');
      }
      const origin = mcpClientOrigin({
        clientId,
        clientName: caller.via?.clientName ?? null,
      });
      return createSignal(
        input,
        { actor: caller, origin },
        { rateLimiter: getSignalCreateLimiter() },
      );
    },
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
  // A write that outlives the tool deadline is still watched after the response, so its outcome
  // is logged; `after` keeps the function alive until then.
  keepAlive: (work) => after(work),
});
