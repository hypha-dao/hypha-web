import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchSpaceProposalsIds } from '@hypha-platform/core/client';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { z } from 'zod';

const proposalStatusSchema = z.enum(['accepted', 'rejected', 'onVoting']);

export const getSpaceProposalsBySpaceSlugInputSchema = {
  slug: z
    .string()
    .trim()
    .min(1, 'Space slug is required')
    .describe('Hypha space slug, for example "hypha"'),
};

export const getSpaceProposalsBySpaceSlugOutputSchema = z
  .object({
    found: z.boolean(),
    slug: z.string(),
    space: z
      .object({
        id: z.number(),
        slug: z.string(),
        title: z.string(),
        web3SpaceId: z.number().nullable(),
      })
      .nullable(),
    proposalIds: z.object({
      accepted: z.array(z.string()),
      rejected: z.array(z.string()),
      onVoting: z.array(z.string()),
    }),
    proposals: z.array(
      z.object({
        id: z.string(),
        status: proposalStatusSchema,
        title: z.string(),
        slug: z.string().nullable(),
        label: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
    counts: z.object({
      accepted: z.number(),
      rejected: z.number(),
      onVoting: z.number(),
      totalIndexedInSpace: z.number(),
      totalOnchainTracked: z.number(),
    }),
  })
  .strict();

type GetSpaceProposalsBySpaceSlugStructuredContent = z.infer<
  typeof getSpaceProposalsBySpaceSlugOutputSchema
>;

function safeDateToISOString(value: unknown): string {
  const candidate = new Date(value as string | number | Date);
  if (Number.isNaN(candidate.getTime())) {
    return new Date(0).toISOString();
  }
  return candidate.toISOString();
}

function buildNotFoundResult(
  slug: string,
): GetSpaceProposalsBySpaceSlugStructuredContent {
  return {
    found: false,
    slug,
    space: null,
    proposalIds: {
      accepted: [],
      rejected: [],
      onVoting: [],
    },
    proposals: [],
    counts: {
      accepted: 0,
      rejected: 0,
      onVoting: 0,
      totalIndexedInSpace: 0,
      totalOnchainTracked: 0,
    },
  };
}

export async function handleGetSpaceProposalsBySpaceSlug({
  slug,
}: {
  slug: string;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: GetSpaceProposalsBySpaceSlugStructuredContent;
}> {
  const space = await getSpaceBySlug({ slug });

  if (!space) {
    const output = buildNotFoundResult(slug);
    return {
      content: [
        {
          type: 'text',
          text: `No space found for slug "${slug}".`,
        },
      ],
      structuredContent: output,
    };
  }

  const web3SpaceId =
    typeof space.web3SpaceId === 'number' &&
    Number.isSafeInteger(space.web3SpaceId) &&
    space.web3SpaceId > 0
      ? space.web3SpaceId
      : null;

  const proposalBuckets = web3SpaceId
    ? await fetchSpaceProposalsIds({ spaceIds: [BigInt(web3SpaceId)] })
    : [];
  const firstBucket = proposalBuckets[0];
  const acceptedIds = (firstBucket?.accepted ?? []).map((id) => id.toString());
  const rejectedIds = (firstBucket?.rejected ?? []).map((id) => id.toString());
  const acceptedSet = new Set(acceptedIds);
  const rejectedSet = new Set(rejectedIds);

  const proposalDocuments = (space.documents ?? []).filter(
    (document): document is NonNullable<typeof document> =>
      document.web3ProposalId != null,
  );

  const proposals = proposalDocuments.map((document) => {
    const id = String(document.web3ProposalId);
    const status = acceptedSet.has(id)
      ? 'accepted'
      : rejectedSet.has(id)
      ? 'rejected'
      : 'onVoting';

    return {
      id,
      status,
      title: document.title ?? '',
      slug: document.slug ?? null,
      label: document.label ?? null,
      createdAt: safeDateToISOString(document.createdAt),
      updatedAt: safeDateToISOString(document.updatedAt),
    } as const;
  });

  const onVotingIds = proposals
    .filter((proposal) => proposal.status === 'onVoting')
    .map((proposal) => proposal.id);

  const output: GetSpaceProposalsBySpaceSlugStructuredContent = {
    found: true,
    slug,
    space: {
      id: space.id,
      slug: space.slug,
      title: space.title,
      web3SpaceId,
    },
    proposalIds: {
      accepted: acceptedIds,
      rejected: rejectedIds,
      onVoting: onVotingIds,
    },
    proposals,
    counts: {
      accepted: acceptedIds.length,
      rejected: rejectedIds.length,
      onVoting: onVotingIds.length,
      totalIndexedInSpace: proposals.length,
      totalOnchainTracked:
        acceptedIds.length + rejectedIds.length + onVotingIds.length,
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: `Found ${proposals.length} indexed proposal(s) for space "${space.title}" (${space.slug}).`,
      },
    ],
    structuredContent: output,
  };
}

export function registerGetSpaceProposalsBySpaceSlugTool(
  server: McpServer,
): void {
  server.registerTool(
    'get_space_proposals_by_space_slug',
    {
      title: 'Get Space Proposals By Space Slug',
      description:
        'Returns proposal IDs and indexed proposal documents for a Hypha space slug, grouped by accepted/rejected/on-voting status.',
      inputSchema: getSpaceProposalsBySpaceSlugInputSchema,
      outputSchema: getSpaceProposalsBySpaceSlugOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handleGetSpaceProposalsBySpaceSlug,
  );
}
