import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  coherences,
  documents,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../server';
import { personColumns } from './queries';
import { readPrimaryOrientation } from './primary-orientation-column';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { listPendingSpaceMemberInvites } from '../../space/server/space-member-invites';
import { SPACE_ACTOR_SUB_PREFIX } from './space-actor-person';
import {
  buildMemberGuidance,
  parseMemberOrientation,
} from '../member-intelligence-guidance';
import { type Hex } from 'viem';

import { web3Client } from '../../common/server/web3-rpc/client';
import { getMemberSpaces } from '../../space/client/web3/dao-space-factory/get-member-spaces';
import { getSpaceMembers } from '../../space/client/web3/dao-space-factory/get-space-members';
import type {
  MemberAttentionItem,
  MemberIntelligence,
  MemberSpaceLogo,
  MemberSpaceRow,
  NetworkCapitalAsk,
} from '../member-intelligence';
import {
  peopleSharingMemberSpaces,
  pickNotificationsAcrossSpaces,
} from '../member-intelligence';

export {
  MEMBER_ORIENTATIONS,
  buildMemberGuidance,
  parseMemberOrientation,
  type MemberOrientation,
} from '../member-intelligence-guidance';
export type {
  MemberAttentionItem,
  MemberIntelligence,
  NetworkCapitalAsk,
} from '../member-intelligence';

const ATTENTION_LIMIT = 8;
const LIST_LIMIT = 6;

const memberSpaceColumns = {
  id: spaces.id,
  slug: spaces.slug,
  title: spaces.title,
  description: spaces.description,
  logoUrl: spaces.logoUrl,
  ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
  ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
};

function toSpaceLogo(row: {
  logoUrl: string | null;
  ecosystemLogoUrlLight: string | null;
  ecosystemLogoUrlDark: string | null;
}): MemberSpaceLogo {
  return {
    logoUrl: row.logoUrl,
    ecosystemLogoUrlLight: row.ecosystemLogoUrlLight,
    ecosystemLogoUrlDark: row.ecosystemLogoUrlDark,
  };
}

function walletAddress(address: string | null | undefined): Hex | null {
  const value = address?.trim();
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value as Hex;
}

/**
 * Postgres `memberships` is not the live roster (nothing in this repo writes
 * it). The profile and My Spaces screens read `getMemberSpaces` for the
 * wallet. A failed chain read throws. The spaces slice catches that on its
 * own, so the rest of the home still returns. An empty list means the wallet
 * has no on-chain spaces.
 */
async function chainWeb3SpaceIds(address: string | null | undefined) {
  const wallet = walletAddress(address);
  if (!wallet) return [];
  const web3SpaceIds = (await web3Client.readContract(
    getMemberSpaces({ memberAddress: wallet }),
  )) as readonly bigint[];
  return [
    ...new Set(
      web3SpaceIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

/**
 * People around the caller are other human profiles whose wallets are in
 * `getSpaceMembers` for the caller's spaces. That is the same factory
 * membership list `getMemberSpaces` reads. Postgres `memberships` is not
 * written by this app, so joining it always reported zero.
 * Archived spaces are already absent from `spaceIds`.
 */
async function loadSharedPeople(
  {
    personId,
    spaceIds,
    limit,
  }: { personId: number; spaceIds: number[]; limit: number },
  { db }: DbConfig,
): Promise<{
  count: number;
  connections: MemberIntelligence['connections'];
}> {
  const empty = {
    count: 0,
    connections: [] as MemberIntelligence['connections'],
  };
  if (spaceIds.length === 0) return empty;

  const rosterSpaces = await db
    .select({
      id: spaces.id,
      web3SpaceId: spaces.web3SpaceId,
    })
    .from(spaces)
    .where(and(inArray(spaces.id, spaceIds), eq(spaces.isArchived, false)));

  const seenChainIds = new Set<number>();
  const chainSpaces = rosterSpaces.filter((row) => {
    const web3SpaceId = row.web3SpaceId;
    if (
      web3SpaceId == null ||
      web3SpaceId <= 0 ||
      seenChainIds.has(web3SpaceId)
    ) {
      return false;
    }
    seenChainIds.add(web3SpaceId);
    return true;
  });
  if (chainSpaces.length === 0) return empty;

  const membersBySpace = await Promise.all(
    chainSpaces.map(async (row) => {
      try {
        const addresses = (await web3Client.readContract(
          getSpaceMembers({ spaceId: BigInt(row.web3SpaceId as number) }),
        )) as readonly `0x${string}`[];
        return { spaceId: row.id, addresses };
      } catch (error) {
        console.error(
          '[getMemberIntelligence] space members failed',
          row.id,
          error,
        );
        return {
          spaceId: row.id,
          addresses: [] as readonly `0x${string}`[],
        };
      }
    }),
  );

  const addressKeys = new Set<string>();
  for (const space of membersBySpace) {
    for (const address of space.addresses) {
      const key = address.trim().toLowerCase();
      if (key) addressKeys.add(key);
    }
  }
  if (addressKeys.size === 0) return empty;

  const peopleRows = await db
    .select({
      id: people.id,
      slug: people.slug,
      name: people.name,
      surname: people.surname,
      nickname: people.nickname,
      avatarUrl: people.avatarUrl,
      address: people.address,
      sub: people.sub,
    })
    .from(people)
    .where(
      inArray(
        sql`upper(${people.address})`,
        [...addressKeys].map((address) => address.toUpperCase()),
      ),
    );

  return peopleSharingMemberSpaces({
    callerPersonId: personId,
    membersBySpace,
    people: peopleRows,
    spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
    limit,
  });
}

async function loadChainMemberSpaces(
  address: string | null | undefined,
  { db }: DbConfig,
): Promise<MemberSpaceRow[]> {
  const web3SpaceIds = await chainWeb3SpaceIds(address);
  if (web3SpaceIds.length === 0) return [];
  const chainOrder = new Map(web3SpaceIds.map((id, index) => [id, index]));
  return (
    await db
      .select({
        ...memberSpaceColumns,
        web3SpaceId: spaces.web3SpaceId,
      })
      .from(spaces)
      .where(
        and(
          inArray(spaces.web3SpaceId, web3SpaceIds),
          eq(spaces.isArchived, false),
        ),
      )
  )
    .slice()
    .sort(
      (left, right) =>
        (chainOrder.get(left.web3SpaceId ?? 0) ?? web3SpaceIds.length) -
        (chainOrder.get(right.web3SpaceId ?? 0) ?? web3SpaceIds.length),
    )
    .map(({ web3SpaceId: _web3SpaceId, ...space }) => space);
}

/** One failed query returns its fallback. The other slices still load. */
async function readSlice<T>(
  label: string,
  read: () => Promise<T>,
  fallback: NoInfer<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error(`[getMemberIntelligence] ${label} failed`, error);
    return fallback;
  }
}

function excerpt(value: string | null | undefined, max = 180): string {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function getMemberIntelligence(
  { personId, limit = LIST_LIMIT }: { personId: number; limit?: number },
  { db }: DbConfig,
): Promise<MemberIntelligence | null> {
  const listLimit = Math.min(Math.max(limit, 1), 24);

  const [person] = await db
    .select(personColumns())
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  if (!person?.slug) return null;
  const primaryOrientation = await readSlice(
    'orientation',
    () => readPrimaryOrientation(db, person.id),
    null,
  );

  const spaceRows = await readSlice(
    'spaces',
    () => loadChainMemberSpaces(person.address, { db }),
    [],
  );
  const spaceIds = spaceRows.map((space) => space.id);
  const orientation = parseMemberOrientation(primaryOrientation);

  const proposalSlice = await readSlice(
    'proposals',
    async () => {
      const proposalRows =
        spaceIds.length === 0
          ? []
          : await db
              .select({
                id: documents.id,
                slug: documents.slug,
                title: documents.title,
                state: documents.state,
                label: documents.label,
                description: documents.description,
                creatorId: documents.creatorId,
                createdAt: documents.createdAt,
                web3ProposalId: documents.web3ProposalId,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(documents)
              .innerJoin(spaces, eq(documents.spaceId, spaces.id))
              .where(
                and(
                  inArray(documents.spaceId, spaceIds),
                  inArray(documents.state, ['proposal', 'discussion']),
                ),
              )
              .orderBy(desc(documents.createdAt))
              .limit(listLimit);
      const openProposalCount =
        spaceIds.length === 0
          ? 0
          : (
              await db
                .select({
                  value: sql<number>`cast(count(*) as integer)`,
                })
                .from(documents)
                .where(
                  and(
                    inArray(documents.spaceId, spaceIds),
                    eq(documents.state, 'proposal'),
                  ),
                )
            )[0]?.value ?? 0;
      return {
        proposals: proposalRows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title?.trim() || 'Untitled proposal',
          state: row.state,
          label: row.label,
          spaceSlug: row.spaceSlug,
          spaceTitle: row.spaceTitle,
          spaceLogo: toSpaceLogo(row),
          createdAt: row.createdAt.toISOString(),
          authoredByMember: row.creatorId === personId,
          web3ProposalId: row.web3ProposalId,
        })),
        openProposals: Number(openProposalCount) || 0,
      };
    },
    {
      proposals: [],
      openProposals: 0,
    },
  );

  const signalSlice = await readSlice(
    'signals',
    async () => {
      const signalRows =
        spaceIds.length === 0
          ? []
          : await db
              .select({
                id: coherences.id,
                slug: coherences.slug,
                title: coherences.title,
                type: coherences.type,
                priority: coherences.priority,
                assigneeIds: coherences.assigneeIds,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(coherences)
              .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
              .where(
                and(
                  inArray(coherences.spaceId, spaceIds),
                  or(
                    eq(coherences.archived, false),
                    isNull(coherences.archived),
                  ),
                ),
              )
              .orderBy(desc(coherences.updatedAt))
              .limit(listLimit);
      const signalCount =
        spaceIds.length === 0
          ? 0
          : (
              await db
                .select({
                  value: sql<number>`cast(count(*) as integer)`,
                })
                .from(coherences)
                .where(
                  and(
                    inArray(coherences.spaceId, spaceIds),
                    or(
                      eq(coherences.archived, false),
                      isNull(coherences.archived),
                    ),
                  ),
                )
            )[0]?.value ?? 0;
      return {
        signals: signalRows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          type: row.type,
          priority: row.priority,
          spaceSlug: row.spaceSlug,
          spaceTitle: row.spaceTitle,
          spaceLogo: toSpaceLogo(row),
          assignedToMember: (row.assigneeIds ?? []).includes(personId),
        })),
        count: Number(signalCount) || 0,
      };
    },
    { signals: [], count: 0 },
  );

  const sharedPeople = await readSlice(
    'connections',
    () => loadSharedPeople({ personId, spaceIds, limit: listLimit }, { db }),
    { count: 0, connections: [] },
  );

  const capitalAskCount = await readSlice(
    'capitalAsks',
    async () =>
      (
        await db
          .select({ value: sql<number>`cast(count(*) as integer)` })
          .from(documents)
          .innerJoin(spaces, eq(documents.spaceId, spaces.id))
          .where(
            and(
              eq(documents.label, 'Investment'),
              inArray(documents.state, ['proposal', 'agreement']),
              eq(spaces.isArchived, false),
            ),
          )
      )[0]?.value ?? 0,
    0,
  );

  const notificationSlice = await readSlice(
    'notifications',
    async () => {
      const notificationProposalRows =
        spaceIds.length === 0
          ? []
          : await db
              .selectDistinctOn([documents.spaceId], {
                id: documents.id,
                slug: documents.slug,
                title: documents.title,
                createdAt: documents.createdAt,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(documents)
              .innerJoin(spaces, eq(documents.spaceId, spaces.id))
              .where(
                and(
                  inArray(documents.spaceId, spaceIds),
                  eq(documents.state, 'proposal'),
                  eq(spaces.isArchived, false),
                  or(
                    isNull(documents.creatorId),
                    ne(documents.creatorId, personId),
                  ),
                ),
              )
              .orderBy(documents.spaceId, desc(documents.createdAt));

      const notificationSignalRows =
        spaceIds.length === 0
          ? []
          : await db
              .selectDistinctOn([coherences.spaceId], {
                id: coherences.id,
                slug: coherences.slug,
                title: coherences.title,
                updatedAt: coherences.updatedAt,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(coherences)
              .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
              .where(
                and(
                  inArray(coherences.spaceId, spaceIds),
                  eq(spaces.isArchived, false),
                  or(
                    eq(coherences.archived, false),
                    isNull(coherences.archived),
                  ),
                  sql`${coherences.assigneeIds} @> ${JSON.stringify([
                    personId,
                  ])}::jsonb`,
                ),
              )
              .orderBy(coherences.spaceId, desc(coherences.updatedAt));

      const notificationCandidates = [
        ...notificationProposalRows.flatMap((row) =>
          row.slug
            ? [
                {
                  id: `proposal-${row.id}`,
                  kind: 'proposal' as const,
                  title: row.title?.trim() || 'Untitled proposal',
                  detail: `${row.spaceTitle} · a decision`,
                  spaceSlug: row.spaceSlug,
                  spaceTitle: row.spaceTitle,
                  spaceLogo: toSpaceLogo(row),
                  targetSlug: row.slug,
                  at: row.createdAt.toISOString(),
                },
              ]
            : [],
        ),
        ...notificationSignalRows.flatMap((row) =>
          row.slug
            ? [
                {
                  id: `signal-${row.id}`,
                  kind: 'signal' as const,
                  title: row.title,
                  detail: `${row.spaceTitle} · a signal`,
                  spaceSlug: row.spaceSlug,
                  spaceTitle: row.spaceTitle,
                  spaceLogo: toSpaceLogo(row),
                  targetSlug: row.slug,
                  at: row.updatedAt.toISOString(),
                },
              ]
            : [],
        ),
      ];
      return {
        items: pickNotificationsAcrossSpaces(
          notificationCandidates,
          Math.max(notificationCandidates.length, ATTENTION_LIMIT),
        ),
        count: notificationCandidates.length,
      };
    },
    { items: [] as MemberAttentionItem[], count: 0 },
  );

  const firstName = person.name?.trim() || person.nickname?.trim() || 'there';

  return {
    person: {
      id: person.id,
      slug: person.slug,
      name: person.name,
      surname: person.surname,
      nickname: person.nickname,
      avatarUrl: person.avatarUrl,
      description: person.description,
      address: person.address,
      preferredCurrency: person.preferredCurrency,
      primaryOrientation: orientation,
    },
    counts: {
      spaces: spaceRows.length,
      openProposals: proposalSlice.openProposals,
      signals: signalSlice.count,
      connections: sharedPeople.count,
      notifications: notificationSlice.items.length,
      capitalAsks: Number(capitalAskCount) || 0,
    },
    guidance: {
      narrative: buildMemberGuidance({
        firstName,
        orientation,
        attention: notificationSlice.items[0] ?? null,
        spaceCount: spaceRows.length,
      }),
    },
    attention: notificationSlice.items,
    spaces: spaceRows.slice(0, listLimit).map((space) => ({
      ...space,
      description: excerpt(space.description, 120),
    })),
    proposals: proposalSlice.proposals,
    signals: signalSlice.signals,
    notifications: notificationSlice.items,
    connections: sharedPeople.connections,
    wallet: {
      address: person.address,
      preferredCurrency: person.preferredCurrency,
    },
    chatSpaceSlug: spaceRows[0]?.slug ?? null,
    invites: await readSlice(
      'invites',
      () =>
        listPendingSpaceMemberInvites(
          { personId, memberSpaceIds: spaceIds },
          { db },
        ),
      [],
    ),
  };
}

export async function listNetworkCapitalAsks(
  { limit = 24 }: { limit?: number },
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<NetworkCapitalAsk[]> {
  const rows = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      description: documents.description,
      state: documents.state,
      createdAt: documents.createdAt,
      spaceId: spaces.id,
      web3SpaceId: spaces.web3SpaceId,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(
      and(
        eq(documents.label, 'Investment'),
        inArray(documents.state, ['proposal', 'agreement']),
        eq(spaces.isArchived, false),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(50);

  const accessibleRows = (
    await Promise.all(
      rows.map(async (row) => {
        const gate = await checkSpaceAccessForSpace(
          { id: row.spaceId, web3SpaceId: row.web3SpaceId },
          authToken,
        );
        return gate.hasAccess ? row : null;
      }),
    )
  ).filter((row): row is (typeof rows)[number] => row !== null);

  return accessibleRows
    .slice(0, Math.min(Math.max(limit, 1), 50))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title?.trim() || 'Untitled ask',
      excerpt: excerpt(row.description),
      state: row.state,
      spaceSlug: row.spaceSlug,
      spaceTitle: row.spaceTitle,
      createdAt: row.createdAt.toISOString(),
    }));
}
