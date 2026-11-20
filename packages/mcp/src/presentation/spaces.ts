import { z } from 'zod';
import type { ListSpacesData, SpaceDetail } from '@hypha-platform/core/server';
import { USER_TEXT_CAPS, userText } from './user-text';

const VOTING_POWER_SOURCE = { 1: 'token', 2: 'member', 3: 'voice' } as const;
const JOIN_METHOD = { 0: 'open', 1: 'token_based', 2: 'invite_only' } as const;

const word = <T extends Record<number, string>>(map: T, code: number) =>
  (map as Record<number, string>)[code] ?? null;

// exitMethod is deliberately not exposed: the product hardcodes one value (1, executor-only
// removal) and nothing reads it, so it would only be an opaque number for the model.
const governanceSchema = z
  .object({
    quorum: z.number(),
    unity: z.number(),
    votingPowerSource: z.enum(['token', 'member', 'voice']).nullable(),
    joinMethod: z.enum(['open', 'token_based', 'invite_only']).nullable(),
  })
  .nullable();

export const spaceItemSchema = z.object({
  slug: z.string(),
  url: z.string(),
  userText: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    truncated: z.array(z.enum(['title', 'description'])),
  }),
  parentSlug: z.string().nullable(),
  memberCount: z.number().nullable(),
  lifecycle: z.enum(['sandbox', 'demo', 'live']),
  archived: z.boolean(),
  governance: governanceSchema,
  visibility: z
    .object({ discoverability: z.number(), access: z.number() })
    .nullable()
    .optional(),
});
export type SpaceItem = z.infer<typeof spaceItemSchema>;

type ListedSpace = ListSpacesData['items'][number];

type GovernanceFacts = {
  quorum: number;
  unity: number;
  votingPowerSource: number;
  joinMethod: number;
};

function presentGovernance(
  g: GovernanceFacts | null | undefined,
): z.infer<typeof governanceSchema> {
  if (!g) return null;
  return {
    quorum: g.quorum,
    unity: g.unity,
    votingPowerSource: word(VOTING_POWER_SOURCE, g.votingPowerSource) as
      | 'token'
      | 'member'
      | 'voice'
      | null,
    joinMethod: word(JOIN_METHOD, g.joinMethod) as
      | 'open'
      | 'token_based'
      | 'invite_only'
      | null,
  };
}

/** MCP's own presentation model over a feature function's space. No wallet addresses, ever. */
export function presentSpace(
  space: ListedSpace,
  ctx: {
    spaceUrl(slug: string): string;
    data: Pick<ListSpacesData, 'slugById' | 'memberCountByWeb3Id'>;
    withVisibility: boolean;
  },
): SpaceItem {
  const flags = (space.flags ?? []) as string[];
  const web3Id = space.web3SpaceId;
  const item: SpaceItem = {
    slug: space.slug,
    url: ctx.spaceUrl(space.slug),
    userText: userText({
      title: { value: space.title, max: USER_TEXT_CAPS.title },
      description: {
        value: space.description,
        max: USER_TEXT_CAPS.description,
      },
    }),
    // A parent the caller cannot see is reported as no parent, not by name.
    parentSlug:
      space.parentId != null
        ? ctx.data.slugById.get(space.parentId) ?? null
        : null,
    // null = unknown (never a silent 0): only the chain-derived count is used.
    memberCount:
      typeof web3Id === 'number'
        ? ctx.data.memberCountByWeb3Id.get(web3Id) ?? null
        : null,
    lifecycle: flags.includes('sandbox')
      ? 'sandbox'
      : flags.includes('demo')
      ? 'demo'
      : 'live',
    archived: flags.includes('archived'),
    governance: presentGovernance(space.governance),
  };
  if (ctx.withVisibility) item.visibility = space.visibility ?? null;
  return item;
}

const {
  memberCount: _listMemberCount,
  governance: _g,
  ...detailBase
} = spaceItemSchema.shape;
void [_listMemberCount, _g];

/**
 * One space: the list item's fields, plus `counts` and `governance` (each is left out when the
 * caller asked to omit it). No `subspaces` and no `childSlugs`: the ecosystem tree is later.
 */
export const spaceDetailSchema = z.object({
  ...detailBase,
  governance: governanceSchema.optional(),
  counts: z.object({ memberCount: z.number().nullable() }).optional(),
  asOf: z.string(),
});
export type SpaceDetailItem = z.infer<typeof spaceDetailSchema>;

export function presentSpaceDetail(
  space: SpaceDetail,
  ctx: { spaceUrl(slug: string): string },
): SpaceDetailItem {
  const flags = (space.flags ?? []) as string[];
  const item: SpaceDetailItem = {
    slug: space.slug,
    url: ctx.spaceUrl(space.slug),
    userText: userText({
      title: { value: space.title, max: USER_TEXT_CAPS.title },
      description: {
        value: space.description,
        max: USER_TEXT_CAPS.description,
      },
    }),
    parentSlug: space.parentSlug,
    lifecycle: flags.includes('sandbox')
      ? 'sandbox'
      : flags.includes('demo')
      ? 'demo'
      : 'live',
    archived: flags.includes('archived'),
    asOf: space.asOf,
  };
  if (space.visibility !== undefined) item.visibility = space.visibility;
  if (space.governance !== undefined) {
    item.governance = presentGovernance(
      space.governance as GovernanceFacts | null,
    );
  }
  if (space.counts !== undefined) item.counts = space.counts;
  return item;
}
