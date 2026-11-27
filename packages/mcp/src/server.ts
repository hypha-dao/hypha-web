import { McpServer } from '@modelcontextprotocol/server';
import {
  DESCRIPTIONS_VERSION,
  SERVER_INSTRUCTIONS,
  SERVER_NAME,
  SERVER_TITLE,
  TOOL_ORDER,
  type ToolName,
} from './descriptions';
import type { McpDeps } from './deps';
import { registerCreateSignal } from './tools/create-signal';
import { registerGetSpace } from './tools/get-space';
import { registerGetMyMembership } from './tools/get-my-membership';
import { registerGetMyVote } from './tools/get-my-vote';
import { registerListProposals } from './tools/list-proposals';
import { registerListQuests } from './tools/list-quests';
import { registerListSignals } from './tools/list-signals';
import { registerListSpaces } from './tools/list-spaces';

const REGISTRARS: Record<ToolName, (server: McpServer, deps: McpDeps) => void> =
  {
    hypha_list_spaces: registerListSpaces,
    hypha_get_space: registerGetSpace,
    hypha_list_proposals: registerListProposals,
    hypha_get_my_vote: registerGetMyVote,
    hypha_get_my_membership: registerGetMyMembership,
    hypha_list_signals: registerListSignals,
    hypha_list_quests: registerListQuests,
    hypha_create_signal: registerCreateSignal,
  };

/**
 * Tools that write, with the scope each needs. They are registered only while writes are switched
 * on (`McpDeps.writesEnabled`); the route answers a call without the scope with a step-up 403.
 */
export const WRITE_TOOL_SCOPES: Readonly<Partial<Record<ToolName, string>>> = {
  hypha_create_signal: 'signals:write',
};

/**
 * One server per request (the SDK handler calls the factory for every HTTP request), built
 * for exactly one resolved caller. Tools are registered in the fixed `TOOL_ORDER`, so
 * `tools/list` is deterministic (K34); write tools are left out entirely while writes are off. Cache hints are the conservative default on purpose:
 * `ttlMs: 0`, `cacheScope: 'private'` (every answer is per user).
 */
export function createHyphaMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, title: SERVER_TITLE, version: DESCRIPTIONS_VERSION },
    {
      instructions: SERVER_INSTRUCTIONS,
      cacheHints: {
        'tools/list': { ttlMs: 0, cacheScope: 'private' },
      },
    },
  );
  for (const name of TOOL_ORDER) {
    if (WRITE_TOOL_SCOPES[name] && deps.writesEnabled !== true) continue;
    REGISTRARS[name](server, deps);
  }
  return server;
}
