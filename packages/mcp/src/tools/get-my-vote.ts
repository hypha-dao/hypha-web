import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { failureText, runTool } from './run-tool';

const P = TOOLS.hypha_get_my_vote.params;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const VOTING_POWER_SOURCE = { 1: 'token', 2: 'member', 3: 'voice' } as const;

export const getMyVoteInput = z.object({
  spaceSlug: z.string().min(1).max(120).regex(SLUG).describe(P.spaceSlug),
  documentSlug: z.string().min(1).max(255).regex(SLUG).describe(P.documentSlug),
});

export const getMyVoteOutput = z.object({
  hasVoted: z.boolean(),
  vote: z.enum(['yes', 'no']).nullable(),
  canVote: z.boolean(),
  reason: z.enum([
    'eligible',
    'proposal_withdrawn',
    'proposal_closed',
    'voting_not_started',
    'voting_ended',
    'not_member_or_delegate',
    'no_voting_power',
  ]),
  isMember: z.boolean(),
  isDelegate: z.boolean(),
  /** Decimal string; the token decimals are in `votingPowerDecimals`. */
  votingPower: z.string(),
  votingPowerDecimals: z.number(),
  votingPowerSource: z.enum(['token', 'member', 'voice']).nullable(),
  asOf: z.string(),
});

export function registerGetMyVote(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_get_my_vote',
    {
      title: TOOLS.hypha_get_my_vote.title,
      description: TOOLS.hypha_get_my_vote.description,
      inputSchema: getMyVoteInput,
      outputSchema: getMyVoteOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_get_my_vote', async (caller) => {
        const r = await deps.features.getMyVote(
          { spaceSlug: args.spaceSlug, documentSlug: args.documentSlug },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const d = r.data;
        return {
          ok: true,
          result: {
            hasVoted: d.hasVoted,
            vote: d.vote,
            canVote: d.canVote,
            reason: d.reason,
            isMember: d.isMember,
            isDelegate: d.isDelegate,
            votingPower: d.votingPower,
            votingPowerDecimals: d.votingPowerDecimals,
            votingPowerSource:
              (VOTING_POWER_SOURCE as Record<number, string>)[
                d.votingPowerSource
              ] ?? null,
            asOf: d.asOf,
          },
        };
      }),
  );
}
