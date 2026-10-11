import {
  and,
  desc,
  eq,
  inArray,
  lt,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import {
  coherences,
  documents,
  events,
  people,
  spaces,
  tokens,
} from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../server';
import { personColumns } from './queries';
import {
  readPrimaryOrientation,
  readPrimaryOrientations,
} from './primary-orientation-column';
import { checkSpaceAccessForSpace } from '../../space/server/check-space-access-for-roster';
import { listPendingSpaceMemberInvites } from '../../space/server/space-member-invites';
import {
  CAPITAL_ASK_PAGE_SIZE,
  walkAccessibleCapitalAsks,
  type CapitalAskCursor,
} from './capital-ask-window';
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
  peerNamesByPerson,
  peopleSharingMemberSpaces,
  pickNotificationsAcrossSpaces,
} from '../member-intelligence';
import {
  movementKindForAgreement,
  selectMemberMovement,
} from '../member-situation';
import { SpaceTransparencyLevel } from '../../space/transparency-policy';
import { readSpaceOnChainTransparency } from '../../space/server/read-space-on-chain-transparency';
import {
  NETWORK_HORIZON_CANDIDATE_LIMIT,
  rankNetworkHorizonSignals,
  signalTypesForOrientation,
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
const CONNECTION_LIMIT = 12;

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
const CREATOR_PEER_LIMIT = 4;
const OUTSIDE_CREATOR_LIMIT = 3;
const OUTSIDE_SPACE_LIMIT = 2;

async function loadSharedPeople(
  {
    personId,
    spaceIds,
    limit,
    focusPersonIds,
  }: {
    personId: number;
    spaceIds: number[];
    limit: number;
    focusPersonIds: readonly number[];
  },
  { db }: DbConfig,
): Promise<{
  count: number;
  connections: MemberIntelligence['connections'];
  peers: Record<number, string[]>;
}> {
  const empty = {
    count: 0,
    connections: [] as MemberIntelligence['connections'],
    peers: {} as Record<number, string[]>,
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

  const shared = peopleSharingMemberSpaces({
    callerPersonId: personId,
    membersBySpace,
    people: peopleRows,
    spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
    limit,
  });
  const orientations = await readPrimaryOrientations(
    db,
    shared.connections.map((person) => person.id),
  );
  const peers = peerNamesByPerson({
    callerPersonId: personId,
    membersBySpace,
    people: peopleRows,
    spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
    focusPersonIds,
    limit: CREATOR_PEER_LIMIT,
  });
  return {
    count: shared.count,
    connections: shared.connections.map((person) => ({
      ...person,
      primaryOrientation: orientations.get(person.id) ?? null,
    })),
    peers: Object.fromEntries(peers),
  };
}

/**
 * People a creator shares a space with, when they are not already in the
 * caller's roster. Bounded chain reads. Postgres memberships are not the
 * live roster, so this uses the same factory lists as the home.
 */
async function loadOutsideCreatorPeers(
  creators: ReadonlyArray<{ id: number; address: string | null }>,
  excludePersonId: number,
  { db }: DbConfig,
): Promise<Record<number, string[]>> {
  const peers: Record<number, string[]> = {};
  for (const creator of creators.slice(0, OUTSIDE_CREATOR_LIMIT)) {
    const wallet = walletAddress(creator.address);
    if (!wallet || creator.id === excludePersonId) continue;
    const web3SpaceIds = (await chainWeb3SpaceIds(wallet)).slice(
      0,
      OUTSIDE_SPACE_LIMIT,
    );
    if (web3SpaceIds.length === 0) continue;
    const membersBySpace = await Promise.all(
      web3SpaceIds.map(async (web3SpaceId) => {
        const addresses = (await web3Client.readContract(
          getSpaceMembers({ spaceId: BigInt(web3SpaceId) }),
        )) as readonly `0x${string}`[];
        return { spaceId: web3SpaceId, addresses };
      }),
    );
    const addressKeys = new Set<string>();
    for (const space of membersBySpace) {
      for (const address of space.addresses) {
        const key = address.trim().toLowerCase();
        if (key) addressKeys.add(key);
      }
    }
    if (addressKeys.size === 0) continue;
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
    const names = peerNamesByPerson({
      callerPersonId: excludePersonId,
      membersBySpace,
      people: peopleRows,
      spaceActorSubPrefix: SPACE_ACTOR_SUB_PREFIX,
      focusPersonIds: [creator.id],
      limit: CREATOR_PEER_LIMIT,
    }).get(creator.id);
    if (names && names.length > 0) peers[creator.id] = names;
  }
  return peers;
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
    allowedTypes,
  }: {
    personId: number;
    profile: MemberHorizonProfile;
    spaceIds: number[];
    allowedTypes: readonly string[];
  },
  { db }: DbConfig,
): Promise<NetworkHorizonSignal[]> {
  if (allowedTypes.length === 0) return [];
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
        inArray(coherences.type, [...allowedTypes]),
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

  return rankNetworkHorizonSignals(
    profile,
    candidates,
    undefined,
    allowedTypes,
  );
}

async function spaceActivityIsOpen(
  spaceRows: Array<{ web3SpaceId?: number | null }>,
  spaceIds: number[],
  { db }: DbConfig,
): Promise<boolean> {
  if (spaceIds.length === 0) return false;
  const shared = await db
    .select({ value: sql<number>`cast(count(*) as integer)` })
    .from(coherences)
    .where(
      and(
        inArray(coherences.spaceId, spaceIds),
        eq(coherences.sharedWithNetwork, true),
        or(eq(coherences.archived, false), isNull(coherences.archived)),
      ),
    );
  if (Number(shared[0]?.value) > 0) return true;
  for (const space of spaceRows.slice(0, 4)) {
    const web3SpaceId = space.web3SpaceId;
    if (web3SpaceId == null || web3SpaceId <= 0) continue;
    const transparency = await readSpaceOnChainTransparency(web3SpaceId);
    if (transparency && transparency.access <= SpaceTransparencyLevel.NETWORK) {
      return true;
    }
  }
  return false;
}

async function loadMemberMovement(
  spaceRows: MemberSpaceRow[],
  { db }: DbConfig,
): Promise<MemberIntelligence['movement']> {
  const spaceIds = spaceRows.map((space) => space.id);
  if (spaceIds.length === 0) return [];
  const spacesById = new Map(spaceRows.map((space) => [space.id, space]));
  const agreementRows = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      label: documents.label,
      createdAt: documents.createdAt,
      spaceId: documents.spaceId,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
      logoUrl: spaces.logoUrl,
      ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
      ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
      voting: tokens.isVotingToken,
      tokenType: tokens.type,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .leftJoin(tokens, eq(tokens.agreementId, documents.id))
    .where(
      and(
        inArray(documents.spaceId, spaceIds),
        eq(documents.state, 'agreement'),
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(12);
  const seenAgreements = new Set<number>();
  const movement: NonNullable<MemberIntelligence['movement']> = [];
  for (const row of agreementRows) {
    if (seenAgreements.has(row.id) || !row.spaceSlug) continue;
    seenAgreements.add(row.id);
    movement.push({
      id: `agreement-${row.id}`,
      kind: movementKindForAgreement({
        label: row.label,
        voting: row.voting === true,
        tokenType: row.tokenType,
      }),
      title: row.title?.trim() || 'An agreement',
      spaceSlug: row.spaceSlug,
      spaceTitle: row.spaceTitle,
      spaceLogo: toSpaceLogo(row),
      documentSlug: row.slug,
      at: row.createdAt.toISOString(),
    });
  }

  const joins = await db
    .select({
      id: events.id,
      createdAt: events.createdAt,
      referenceId: events.referenceId,
      parameters: events.parameters,
    })
    .from(events)
    .where(
      and(
        eq(events.type, 'joinSpace'),
        eq(events.referenceEntity, 'space'),
        inArray(events.referenceId, spaceIds),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(4);
  const addresses = joins.flatMap((row) => {
    const parameters = row.parameters as { memberAddress?: unknown } | null;
    const address =
      typeof parameters?.memberAddress === 'string'
        ? parameters.memberAddress.trim()
        : '';
    return address ? [address] : [];
  });
  const named =
    addresses.length === 0
      ? []
      : await db
          .select({
            name: people.name,
            surname: people.surname,
            nickname: people.nickname,
            address: people.address,
          })
          .from(people)
          .where(
            inArray(
              sql`upper(${people.address})`,
              addresses.map((address) => address.toUpperCase()),
            ),
          );
  const nameByAddress = new Map(
    named.flatMap((person) => {
      const address = person.address?.trim().toLowerCase();
      const label = creatorLabel(person.name, person.surname, person.nickname);
      return address && label ? [[address, label] as const] : [];
    }),
  );
  for (const row of joins) {
    const space = spacesById.get(row.referenceId);
    if (!space?.slug) continue;
    const parameters = row.parameters as { memberAddress?: unknown } | null;
    const address =
      typeof parameters?.memberAddress === 'string'
        ? parameters.memberAddress.trim().toLowerCase()
        : '';
    const who = (address && nameByAddress.get(address)) || 'Someone';
    movement.push({
      id: `join-${row.id}`,
      kind: 'joined',
      title: who,
      spaceSlug: space.slug,
      spaceTitle: space.title,
      spaceLogo: {
        logoUrl: space.logoUrl,
        ecosystemLogoUrlLight: space.ecosystemLogoUrlLight ?? null,
        ecosystemLogoUrlDark: space.ecosystemLogoUrlDark ?? null,
      },
      documentSlug: null,
      at: row.createdAt.toISOString(),
    });
  }
  return selectMemberMovement(movement);
}

function excerpt(value: string | null | undefined, max = 180): string {
  const text = (value ?? '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function optionalExcerpt(value: string | null | undefined): string | null {
  const text = excerpt(value, 220);
  return text || null;
}

/** The newest discussion leads. A notification is the lead only when none is open. */
function guidanceAttention(
  note: MemberAttentionItem | undefined,
  records: {
    signals: MemberIntelligence['signals'];
    proposals: MemberIntelligence['proposals'];
  },
) {
  const discussion = records.proposals.find(
    (item) => item.state?.trim().toLowerCase() === 'discussion',
  );
  if (discussion) {
    return {
      title: discussion.title,
      spaceTitle: discussion.spaceTitle,
      kind: 'proposal' as const,
      category: discussion.label,
      summary: discussion.description,
      creatorName: discussion.creatorName,
      documentState: 'discussion',
    };
  }
  return leadAttention(note, records);
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
                web3SpaceId: spaces.web3SpaceId,
                leadImage: documents.leadImage,
                creatorName: people.name,
                creatorSurname: people.surname,
                creatorNickname: people.nickname,
                creatorAvatarUrl: people.avatarUrl,
                creatorAddress: people.address,
                creatorDescription: people.description,
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
          web3SpaceId: row.web3SpaceId,
          leadImage: row.leadImage,
          description: optionalExcerpt(row.description),
          creatorId: row.creatorId,
          creatorName: creatorLabel(
            row.creatorName,
            row.creatorSurname,
            row.creatorNickname,
          ),
          creatorAvatarUrl: row.creatorAvatarUrl,
          creatorAbout: optionalExcerpt(row.creatorDescription),
        })),
        creators: proposalRows.flatMap((row) =>
          row.creatorId == null
            ? []
            : [{ id: row.creatorId, address: row.creatorAddress }],
        ),
        openProposals: Number(openProposalCount) || 0,
      };
    },
    {
      proposals: [],
      creators: [] as Array<{ id: number; address: string | null }>,
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
                dueAt: coherences.dueAt,
                createdAt: coherences.createdAt,
                progressStatus: coherences.progressStatus,
                assigneeIds: coherences.assigneeIds,
                description: coherences.description,
                tags: coherences.tags,
                creatorId: coherences.creatorId,
                creatorName: people.name,
                creatorSurname: people.surname,
                creatorNickname: people.nickname,
                creatorAvatarUrl: people.avatarUrl,
                creatorAddress: people.address,
                creatorDescription: people.description,
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
          dueAt: row.dueAt?.toISOString() ?? null,
          createdAt: row.createdAt?.toISOString() ?? null,
          progressStatus: row.progressStatus,
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
          creatorAbout: optionalExcerpt(row.creatorDescription),
        })),
        creators: signalRows.flatMap((row) =>
          row.creatorId == null
            ? []
            : [{ id: row.creatorId, address: row.creatorAddress }],
        ),
        count: Number(signalCount) || 0,
        interestTags: signalRows.flatMap((row) => stringTags(row.tags)),
      };
    },
    {
      signals: [],
      creators: [] as Array<{ id: number; address: string | null }>,
      count: 0,
      interestTags: [] as string[],
    },
  );

  const sharedPeople = await readSlice(
    'connections',
    () =>
      loadSharedPeople(
        {
          personId,
          spaceIds,
          limit: Math.max(listLimit, CONNECTION_LIMIT),
          focusPersonIds: [
            ...proposalSlice.creators.map((creator) => creator.id),
            ...signalSlice.creators.map((creator) => creator.id),
          ],
        },
        { db },
      ),
    { count: 0, connections: [], peers: {} },
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
  const networkTypes = signalTypesForOrientation(orientation);
  const networkAllowed =
    networkTypes.length === 0
      ? false
      : await readSlice(
          'networkAccess',
          () => spaceActivityIsOpen(spaceRows, spaceIds, { db }),
          false,
        );
  const networkSignals = networkAllowed
    ? await readSlice(
        'networkSignals',
        () =>
          loadNetworkHorizonSignals(
            {
              personId: person.id,
              spaceIds,
              allowedTypes: networkTypes,
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

  const listedProposalSlugs = new Set(
    proposalSlice.proposals.flatMap((proposal) =>
      proposal.slug ? [proposal.slug] : [],
    ),
  );
  const missingProposalSlugs = notificationSlice.items.flatMap((item) =>
    item.kind === 'proposal' &&
    item.targetSlug &&
    !listedProposalSlugs.has(item.targetSlug)
      ? [item.targetSlug]
      : [],
  );
  const missingProposals =
    missingProposalSlugs.length === 0
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
            web3SpaceId: spaces.web3SpaceId,
            leadImage: documents.leadImage,
            creatorName: people.name,
            creatorSurname: people.surname,
            creatorNickname: people.nickname,
            creatorAvatarUrl: people.avatarUrl,
            creatorAddress: people.address,
            creatorDescription: people.description,
            spaceSlug: spaces.slug,
            spaceTitle: spaces.title,
            logoUrl: spaces.logoUrl,
            ecosystemLogoUrlLight: spaces.ecosystemLogoUrlLight,
            ecosystemLogoUrlDark: spaces.ecosystemLogoUrlDark,
          })
          .from(documents)
          .innerJoin(spaces, eq(documents.spaceId, spaces.id))
          .leftJoin(people, eq(documents.creatorId, people.id))
          .where(inArray(documents.slug, missingProposalSlugs));
  const proposals = [
    ...proposalSlice.proposals,
    ...missingProposals.map((row) => ({
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
      web3SpaceId: row.web3SpaceId,
      leadImage: row.leadImage,
      description: optionalExcerpt(row.description),
      creatorId: row.creatorId,
      creatorName: creatorLabel(
        row.creatorName,
        row.creatorSurname,
        row.creatorNickname,
      ),
      creatorAvatarUrl: row.creatorAvatarUrl,
      creatorAbout: optionalExcerpt(row.creatorDescription),
    })),
  ];
  const creatorWallets = [
    ...proposalSlice.creators,
    ...signalSlice.creators,
    ...missingProposals.flatMap((row) =>
      row.creatorId == null
        ? []
        : [{ id: row.creatorId, address: row.creatorAddress }],
    ),
  ];
  const seenCreators = new Set<number>();
  const outsideCreators = creatorWallets.filter((creator) => {
    if (seenCreators.has(creator.id) || sharedPeople.peers[creator.id]?.length)
      return false;
    seenCreators.add(creator.id);
    return Boolean(creator.address);
  });
  const outsidePeers = await readSlice(
    'creatorPeers',
    () => loadOutsideCreatorPeers(outsideCreators, personId, { db }),
    {} as Record<number, string[]>,
  );
  const creatorPeers = { ...sharedPeople.peers, ...outsidePeers };
  const withPeers = <T extends { creatorId: number | null }>(item: T) => {
    const names =
      item.creatorId == null ? undefined : creatorPeers[item.creatorId];
    return names && names.length > 0 ? { ...item, creatorWith: names } : item;
  };

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
        attention: guidanceAttention(notificationSlice.items[0], {
          signals: signalSlice.signals,
          proposals,
        }),
        spaceCount: spaceRows.length,
      }),
    },
    attention: notificationSlice.items,
    spaces: spaceRows.slice(0, listLimit).map((space) => ({
      ...space,
      description: excerpt(space.description, 120),
    })),
    proposals: proposals.map(withPeers),
    signals: signalSlice.signals.map(withPeers),
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
    movement: await readSlice(
      'movement',
      () => loadMemberMovement(spaceRows, { db }),
      [],
    ),
  };
}

export async function listNetworkCapitalAsks(
  { limit = 24 }: { limit?: number },
  { db, authToken }: DbConfig & { authToken?: string },
): Promise<{ asks: NetworkCapitalAsk[]; complete: boolean }> {
  const { rows, complete } = await walkAccessibleCapitalAsks({
    limit,
    loadPage: async (cursor: CapitalAskCursor | null) => {
      const visible = and(
        eq(documents.label, 'Investment'),
        inArray(documents.state, ['proposal', 'agreement']),
        eq(spaces.isArchived, false),
        cursor
          ? or(
              lt(documents.createdAt, cursor.createdAt),
              and(
                eq(documents.createdAt, cursor.createdAt),
                lt(documents.id, cursor.id),
              ),
            )
          : undefined,
      );
      return db
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
        .where(visible)
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(CAPITAL_ASK_PAGE_SIZE);
    },
    canAccessSpace: async (row) => {
      const gate = await checkSpaceAccessForSpace(
        { id: row.spaceId, web3SpaceId: row.web3SpaceId },
        authToken,
      );
      return gate.hasAccess;
    },
  });

  return {
    complete,
    asks: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title?.trim() || 'Untitled ask',
      excerpt: excerpt(row.description),
      state: row.state,
      spaceSlug: row.spaceSlug,
      spaceTitle: row.spaceTitle,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
