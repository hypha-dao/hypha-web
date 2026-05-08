import type { PaginatedResponse, Person } from '@hypha-platform/core/client';
import { publicClient } from '../../common/web3/public-client';
import { getSpaceDetails } from '../shared/web3/get-space-details';
import type { Space } from '../types';
import {
  memberships,
  people,
  spaces,
  type Membership,
} from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { findAllEvents } from '../../events/server/queries';
import { findSpaceBySlug } from './queries';
import type { DbConfig } from '../../server';
import {
  applySearchFilter,
  buildMemberEntriesFromAddresses,
  mergeJoinEventTimesByAddress,
  normalizeMemberAddress,
  type RosterPerson,
  type SpaceMemberRosterEntry,
} from './get-space-members-roster-helpers';
import { paginateSpaceMembersForHttp } from './paginate-space-members-for-http';

export type {
  MembershipSnake,
  PersonPublic,
  SpaceMemberRosterPerson,
  SpaceMemberRosterSpace,
  SpaceMemberRosterEntry,
} from './get-space-members-roster-helpers';

export type GetSpaceMembersRosterInput = {
  spaceSlug: string;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
};

export type SpaceMembersRosterResult =
  | {
      found: true;
      space_slug: string;
      space: {
        id: number;
        slug: string;
        title: string;
        parent_id: number | null;
      };
      source: 'db';
      source_chain: 'rpc' | null;
      asOf: string;
      members: SpaceMemberRosterEntry[];
      pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
        has_next_page: boolean;
        has_previous_page: boolean;
      };
    }
  | {
      found: false;
      space_slug: string;
      space: null;
      source: 'db';
      source_chain: null;
      asOf: string;
      members: [];
      pagination: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
        has_next_page: boolean;
        has_previous_page: boolean;
      };
    };

async function fetchOnChainMemberAddresses(space: Space): Promise<{
  members: readonly `0x${string}`[];
  /** True only after `readContract` ran; false when web3 id missing / not convertible. */
  queried: boolean;
}> {
  if (
    space.web3SpaceId == null ||
    !canConvertToBigInt(space.web3SpaceId as number)
  ) {
    return { members: [], queried: false };
  }
  const spaceDetails = await publicClient.readContract(
    getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
  );
  const tuple = spaceDetails as readonly unknown[];
  const members = (tuple[4] ?? []) as readonly `0x${string}`[];
  return { members, queried: true };
}

/**
 * Builds the full merged member list (on-chain order) for a space slug.
 * Shared by MCP/chat roster and the HTTP members API.
 */
export async function computeSpaceMemberEntries(
  spaceSlug: string,
  { db }: DbConfig,
): Promise<
  | { found: false }
  | {
      found: true;
      host: Space;
      memberAddresses: readonly `0x${string}`[];
      entries: SpaceMemberRosterEntry[];
      source_chain: 'rpc' | null;
      asOf: string;
    }
> {
  const asOf = new Date().toISOString();
  const host = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!host) {
    return { found: false };
  }

  let memberAddresses: readonly `0x${string}`[] = [];
  let source_chain: 'rpc' | null = null;

  try {
    const onChain = await fetchOnChainMemberAddresses(host);
    memberAddresses = onChain.members;
    source_chain = onChain.queried ? 'rpc' : null;
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : err &&
          typeof err === 'object' &&
          'shortMessage' in err &&
          typeof (err as { shortMessage?: unknown }).shortMessage === 'string'
        ? (err as { shortMessage: string }).shortMessage
        : String(err);
    if (msg.includes('rate limit') || msg.includes('429')) {
      throw err;
    }
    memberAddresses = [];
    source_chain = null;
  }

  if (memberAddresses.length === 0) {
    return {
      found: true,
      host,
      memberAddresses,
      entries: [],
      source_chain,
      asOf,
    };
  }

  const uniqueAddresses = Array.from(
    new Set(memberAddresses.map((a) => a as string)),
  );

  const upperList = uniqueAddresses.map((a) => a.toUpperCase());

  const peopleRows = await db
    .select()
    .from(people)
    .where(inArray(sql`upper(${people.address})`, upperList));

  const peopleByAddress = new Map<string, RosterPerson>();
  for (const row of peopleRows) {
    if (!row.address || !row.createdAt || !row.updatedAt) continue;
    peopleByAddress.set(normalizeMemberAddress(row.address), {
      id: row.id,
      slug: row.slug ?? undefined,
      name: row.name ?? undefined,
      surname: row.surname ?? undefined,
      avatarUrl: row.avatarUrl ?? undefined,
      leadImageUrl: row.leadImageUrl ?? undefined,
      description: row.description ?? undefined,
      location: row.location ?? undefined,
      nickname: row.nickname ?? undefined,
      address: row.address ?? undefined,
      links: (row.links as string[]) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  const spaceRows = await db
    .select()
    .from(spaces)
    .where(
      and(
        inArray(sql`upper(${spaces.address})`, upperList),
        eq(spaces.isArchived, false),
      ),
    );

  const spacesByAddress = new Map<string, Space>();
  for (const row of spaceRows) {
    if (!row.address) continue;
    spacesByAddress.set(normalizeMemberAddress(row.address), row as Space);
  }

  const joinSpaceEvents = await findAllEvents(
    { db },
    {
      type: 'joinSpace',
      referenceId: host.id,
      referenceEntity: 'space',
    },
  );
  const eventJoinTimeByAddress = mergeJoinEventTimesByAddress(joinSpaceEvents);

  const personIds = [...peopleByAddress.values()].map((p) => p.id);
  let membershipByPersonId = new Map<number, Membership>();
  if (personIds.length > 0) {
    const mRows = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.spaceId, host.id),
          inArray(memberships.personId, personIds),
        ),
      );
    membershipByPersonId = new Map(
      mRows.map((m) => [m.personId, m as Membership]),
    );
  }

  const entries = buildMemberEntriesFromAddresses({
    memberAddresses,
    peopleByAddress,
    spacesByAddress,
    membershipByPersonId,
    eventJoinTimeByAddress,
  });

  return {
    found: true,
    host,
    memberAddresses,
    entries,
    source_chain,
    asOf,
  };
}

export async function getSpaceMembersForHttpApi(
  {
    spaceSlug,
    page = 1,
    pageSize = 10,
    searchTerm,
  }: {
    spaceSlug: string;
    page?: number;
    pageSize?: number;
    searchTerm?: string;
  },
  { db }: DbConfig,
): Promise<
  | { found: false }
  | {
      found: true;
      persons: PaginatedResponse<Person>;
      spaces: PaginatedResponse<Space>;
    }
> {
  const computed = await computeSpaceMemberEntries(spaceSlug, { db });
  if (!computed.found) {
    return { found: false };
  }

  const filtered = applySearchFilter(computed.entries, searchTerm);
  const personRows = filtered.filter((e) => e.member_kind === 'person');
  const spaceRowsFiltered = filtered.filter((e) => e.member_kind === 'space');

  const personsList = personRows.map((e) => e.person as Person);
  const spacesList = spaceRowsFiltered.map((e) => e.space);

  return {
    found: true,
    persons: paginateSpaceMembersForHttp(personsList, page, pageSize),
    spaces: paginateSpaceMembersForHttp(spacesList, page, pageSize),
  };
}

export async function getSpaceMembersRoster(
  {
    spaceSlug,
    page = 1,
    pageSize = 20,
    searchTerm,
  }: GetSpaceMembersRosterInput,
  { db }: DbConfig,
): Promise<SpaceMembersRosterResult> {
  const asOf = new Date().toISOString();
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));

  const computed = await computeSpaceMemberEntries(spaceSlug, { db });
  if (!computed.found) {
    return {
      found: false,
      space_slug: spaceSlug,
      space: null,
      source: 'db',
      source_chain: null,
      asOf,
      members: [],
      pagination: {
        total: 0,
        page: safePage,
        page_size: safePageSize,
        total_pages: 0,
        has_next_page: false,
        has_previous_page: false,
      },
    };
  }

  const { host, entries: rawEntries, source_chain } = computed;

  if (rawEntries.length === 0) {
    return {
      found: true,
      space_slug: spaceSlug,
      space: {
        id: host.id,
        slug: host.slug,
        title: host.title,
        parent_id: host.parentId ?? null,
      },
      source: 'db',
      source_chain,
      asOf: computed.asOf,
      members: [],
      pagination: {
        total: 0,
        page: safePage,
        page_size: safePageSize,
        total_pages: 0,
        has_next_page: false,
        has_previous_page: false,
      },
    };
  }

  const entries = applySearchFilter(rawEntries, searchTerm);

  const total = entries.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
  const offset = (safePage - 1) * safePageSize;
  const pageSlice = entries.slice(offset, offset + safePageSize);

  return {
    found: true,
    space_slug: spaceSlug,
    space: {
      id: host.id,
      slug: host.slug,
      title: host.title,
      parent_id: host.parentId ?? null,
    },
    source: 'db',
    source_chain,
    asOf: computed.asOf,
    members: pageSlice,
    pagination: {
      total,
      page: safePage,
      page_size: safePageSize,
      total_pages: totalPages,
      has_next_page: totalPages > 0 && safePage < totalPages,
      has_previous_page: totalPages > 0 && safePage > 1,
    },
  };
}
