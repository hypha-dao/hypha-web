import { z } from 'zod';
import type { ProposalListItem } from '@hypha-platform/core/server';
import { userText } from './user-text';

export const PROPOSAL_TEXT_CAPS = {
  title: 200,
  label: 100,
  creatorName: 200,
} as const;

const percentBlock = z.object({
  requiredPercent: z.number().nullable(),
  progressPercent: z.number(),
  reached: z.boolean().nullable(),
});

export const tallySchema = z
  .object({
    startTime: z.number(),
    endTime: z.number(),
    executed: z.boolean(),
    expired: z.boolean(),
    yesVotes: z.string(),
    noVotes: z.string(),
    totalVotingPowerAtSnapshot: z.string(),
    quorum: percentBlock.extend({ requiredVotes: z.string().nullable() }),
    unity: percentBlock,
    awaitingDecision: z.boolean(),
  })
  .nullable();

export const proposalItemSchema = z.object({
  slug: z.string(),
  url: z.string(),
  kind: z.enum(['proposal', 'agreement']),
  /** `null` only when the document has no on-chain proposal id. */
  status: z.enum(['onVoting', 'accepted', 'rejected', 'withdrawn']).nullable(),
  createdAt: z.string(),
  userText: z.object({
    title: z.string().nullable(),
    label: z.string().nullable(),
    creatorName: z.string().nullable(),
    truncated: z.array(z.enum(['title', 'label', 'creatorName'])),
  }),
  tally: tallySchema.optional(),
});
export type ProposalItem = z.infer<typeof proposalItemSchema>;

/**
 * MCP's own presentation model over a feature function's proposal. Titles, the label and the
 * creator's display name are written by Hypha users, so they sit in the `userText` group; the
 * creator's avatar URL and any address are not part of it.
 */
export function presentProposal(
  item: ProposalListItem,
  ctx: { proposalUrl(slug: string): string },
): ProposalItem {
  const creatorName = item.creator
    ? [item.creator.name, item.creator.surname].filter(Boolean).join(' ')
    : '';
  const out: ProposalItem = {
    slug: item.slug,
    url: ctx.proposalUrl(item.slug),
    kind: item.kind,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    userText: userText({
      title: { value: item.title, max: PROPOSAL_TEXT_CAPS.title },
      label: { value: item.label, max: PROPOSAL_TEXT_CAPS.label },
      creatorName: {
        value: creatorName === '' ? null : creatorName,
        max: PROPOSAL_TEXT_CAPS.creatorName,
      },
    }),
  };
  if (item.tally !== undefined) out.tally = item.tally;
  return out;
}
