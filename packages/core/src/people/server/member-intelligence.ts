import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
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
import {
  NETWORK_HORIZON_CANDIDATE_LIMIT,
  NETWORK_SIGNAL_TYPES,
  rankNetworkHorizonSignals,
  type MemberHorizonProfile,
  type NetworkHorizon,
  type NetworkHorizonCandidate,
  type NetworkHorizonSignal,
} from '../network-horizon';

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
/** Direct-access icons on the home. Other lists stay on LIST_LIMIT. */
const CONNECTION_LIMIT = 8;

const memberSpaceColumns = {
  id: spaces.id,
  slug: spaces.slug,
  title: spaces.title,
  description: spaces.description,
  logoUrl: spaces.logoUrl,
  ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
  ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
  address: spaces.address,
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
    );
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

function isMissingColumn(error: unknown, column: string): boolean {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message)
      parts.push(current.message);
    else if (typeof current === 'string' && current) parts.push(current);
    if (typeof current === 'object' && current && 'cause' in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  const text = parts.join('\n');
  return (
    text.includes(column) &&
    (text.includes('42703') || text.includes('does not exist'))
  );
}

function firstSqlRow(result: unknown): Record<string, unknown> | undefined {
  const row = Array.isArray(result)
    ? result[0]
    : result && typeof result === 'object' && 'rows' in result
    ? (result as { rows?: unknown[] }).rows?.[0]
    : undefined;
  return row && typeof row === 'object'
    ? (row as Record<string, unknown>)
    : undefined;
}

/** Migration 0084 adds this column. Home still loads before it exists. */
async function readNetworkHorizon(
  db: DbConfig['db'],
  personId: number,
): Promise<NetworkHorizon> {
  try {
    const result = await db.execute(
      sql`select network_horizon from people where id = ${personId} limit 1`,
    );
    const value = firstSqlRow(result)?.network_horizon;
    return value === 'network' ? 'network' : 'spaces';
  } catch (error) {
    if (isMissingColumn(error, 'network_horizon')) return 'spaces';
    throw error;
  }
}

function stringTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string');
}

async function loadNetworkHorizonSignals(
  {
    personId,
    profile,
    spaceIds,
  }: {
    personId: number;
    profile: MemberHorizonProfile;
    spaceIds: number[];
  },
  { db }: DbConfig,
): Promise<NetworkHorizonSignal[]> {
  const rows = await db
    .select({
      id: coherences.id,
      slug: coherences.slug,
      title: coherences.title,
      type: coherences.type,
      description: coherences.description,
      tags: coherences.tags,
      updatedAt: coherences.updatedAt,
      creatorId: coherences.creatorId,
      creatorName: people.name,
      creatorSurname: people.surname,
      creatorNickname: people.nickname,
      creatorAvatarUrl: people.avatarUrl,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
      spaceDescription: spaces.description,
      spaceLocation: spaces.locationLabel,
      logoUrl: spaces.logoUrl,
      ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
      ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
    })
    .from(coherences)
    .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
    .leftJoin(people, eq(coherences.creatorId, people.id))
    .where(
      and(
        eq(coherences.sharedWithNetwork, true),
        or(eq(coherences.archived, false), isNull(coherences.archived)),
        inArray(coherences.type, [...NETWORK_SIGNAL_TYPES]),
        eq(spaces.isArchived, false),
        or(isNull(coherences.creatorId), ne(coherences.creatorId, personId)),
        spaceIds.length > 0
          ? notInArray(coherences.spaceId, spaceIds)
          : undefined,
      ),
    )
    .orderBy(desc(coherences.updatedAt))
    .limit(NETWORK_HORIZON_CANDIDATE_LIMIT);

  const candidates: NetworkHorizonCandidate[] = rows.flatMap((row) => {
    if (!row.spaceSlug) return [];
    return [
      {
        id: row.id,
        slug: row.slug,
        title: row.title,
        type: row.type,
        description: optionalExcerpt(row.description),
        tags: stringTags(row.tags),
        updatedAt: row.updatedAt.toISOString(),
        spaceSlug: row.spaceSlug,
        spaceTitle: row.spaceTitle,
        spaceDescription: row.spaceDescription,
        spaceLocation: row.spaceLocation,
        spaceLogo: toSpaceLogo(row),
        creatorId: row.creatorId,
        creatorName: creatorLabel(
          row.creatorName,
          row.creatorSurname,
          row.creatorNickname,
        ),
        creatorAvatarUrl: row.creatorAvatarUrl,
      },
    ];
  });

  return rankNetworkHorizonSignals(profile, candidates);
}

function excerpt(value: string | null | undefined, max = 180): string {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function optionalExcerpt(value: string | null | undefined): string | null {
  const text = excerpt(value, 220);
  return text || null;
}

function leadAttention(
  note: MemberAttentionItem | undefined,
  records: {
    signals: MemberIntelligence['signals'];
    proposals: MemberIntelligence['proposals'];
  },
) {
  if (!note) return null;
  if (note.kind === 'signal') {
    const signal = records.signals.find(
      (item) => item.slug === note.targetSlug,
    );
    return {
      title: note.title,
      spaceTitle: note.spaceTitle,
      kind: note.kind,
      category: signal?.type ?? note.category ?? null,
      summary: signal?.description ?? note.summary ?? null,
      creatorName: signal?.creatorName ?? note.creatorName ?? null,
    };
  }
  const proposal = records.proposals.find(
    (item) => item.slug === note.targetSlug,
  );
  return {
    title: note.title,
    spaceTitle: note.spaceTitle,
    kind: note.kind,
    category: proposal?.label ?? note.category ?? null,
    summary: proposal?.description ?? note.summary ?? null,
    creatorName: proposal?.creatorName ?? note.creatorName ?? null,
  };
}

function creatorLabel(
  name: string | null,
  surname: string | null,
  nickname: string | null,
): string | null {
  const full = [name, surname].filter(Boolean).join(' ').trim();
  return full || nickname?.trim() || null;
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
                creatorName: people.name,
                creatorSurname: people.surname,
                creatorNickname: people.nickname,
                creatorAvatarUrl: people.avatarUrl,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(documents)
              .innerJoin(spaces, eq(documents.spaceId, spaces.id))
              .leftJoin(people, eq(documents.creatorId, people.id))
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
          description: optionalExcerpt(row.description),
          creatorId: row.creatorId,
          creatorName: creatorLabel(
            row.creatorName,
            row.creatorSurname,
            row.creatorNickname,
          ),
          creatorAvatarUrl: row.creatorAvatarUrl,
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
                description: coherences.description,
                tags: coherences.tags,
                creatorId: coherences.creatorId,
                creatorName: people.name,
                creatorSurname: people.surname,
                creatorNickname: people.nickname,
                creatorAvatarUrl: people.avatarUrl,
                spaceSlug: spaces.slug,
                spaceTitle: spaces.title,
                logoUrl: spaces.logoUrl,
                ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
                ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
              })
              .from(coherences)
              .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
              .leftJoin(people, eq(coherences.creatorId, people.id))
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
          description: optionalExcerpt(row.description),
          creatorId: row.creatorId,
          creatorName: creatorLabel(
            row.creatorName,
            row.creatorSurname,
            row.creatorNickname,
          ),
          creatorAvatarUrl: row.creatorAvatarUrl,
        })),
        count: Number(signalCount) || 0,
        interestTags: signalRows.flatMap((row) => stringTags(row.tags)),
      };
    },
    { signals: [], count: 0, interestTags: [] as string[] },
  );

  const sharedPeople = await readSlice(
    'connections',
    () =>
      loadSharedPeople(
        {
          personId,
          spaceIds,
          limit: Math.max(listLimit, CONNECTION_LIMIT),
        },
        { db },
      ),
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
  const networkHorizon = await readSlice(
    'networkHorizon',
    () => readNetworkHorizon(db, person.id),
    'spaces' as const,
  );
  const interestTags = signalSlice.interestTags;
  const networkSignals =
    networkHorizon === 'network'
      ? await readSlice(
          'networkSignals',
          () =>
            loadNetworkHorizonSignals(
              {
                personId: person.id,
                spaceIds,
                profile: {
                  location: person.location,
                  description: person.description,
                  spaceTitles: spaceRows.map((space) => space.title),
                  spaceDescriptions: spaceRows.map(
                    (space) => space.description ?? '',
                  ),
                  interestTags,
                },
              },
              { db },
            ),
          [] as NetworkHorizonSignal[],
        )
      : [];

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
      location: person.location,
    },
    networkHorizon,
    networkSignals,
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
        attention: leadAttention(notificationSlice.items[0], {
          signals: signalSlice.signals,
          proposals: proposalSlice.proposals,
        }),
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
