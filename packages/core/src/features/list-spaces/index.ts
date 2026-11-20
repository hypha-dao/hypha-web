import 'server-only';

import type { DbConfig } from '../../server';
import {
  readChainClock,
  readSpaceGovernanceBatch,
  type SpaceGovernance,
  type SpaceVisibility,
} from '../../access/chain-reads';
import type { Caller } from '../../access/caller';
import { failure, type Failure } from '../../access/failure';
import { filterSpacesForCaller } from '../../access/policy';
import { getAllSpaces } from '../../space/server/web3/get-all-spaces';
import { getSpacesBySlugs } from '../../space/server/web3/get-spaces-by-slugs';
import { getSpacesByWeb3Ids } from '../../space/server/web3/get-spaces-by-web3-ids';
import type { Space } from '../../space/types';
import { isSpaceArchived } from '../../space/utils';

export type SpaceGovernanceFacts = Omit<SpaceGovernance, 'memberCount'>;
export type SpaceVisibilityFacts = Pick<
  SpaceVisibility,
  'discoverability' | 'access'
>;

export type ListSpacesInput = {
  /** Source selection as in v1: ids, else slugs, else all (search applies to "all"). */
  web3SpaceIds?: number[];
  slugs?: string[];
  search?: string;
  parentOnly?: boolean;
  omitArchived?: boolean;
  /**
   * Hide spaces that carry the `archived` flag, and nothing else. Unlike `omitArchived`
   * (the product rule: the flag OR a member count of 0) it leaves empty spaces to `omitEmpty`.
   */
  omitFlagArchived?: boolean;
  omitSandbox?: boolean;
  /** Hide spaces with a zero member count. */
  omitEmpty?: boolean;
  /** Sort by title after the filters; unset keeps the source order. */
  titleOrder?: 'asc' | 'desc';
  /** Both absent = the full list. The channel normalises and caps these. */
  paging?: { page: number; pageSize: number };
  with?: { governance?: boolean; visibility?: boolean };
};

export type ListedSpace = Omit<Space, 'memberAddresses'> & {
  visibility?: SpaceVisibilityFacts | null;
  governance?: SpaceGovernanceFacts | null;
};

export type ListSpacesData = {
  /** Only what the caller may see. No wallet-address arrays. */
  items: ListedSpace[];
  /** What the caller may see, before paging. */
  total: number;
  asOf: string;
  asOfBlock: number | null;
  /**
   * Slugs of the VISIBLE spaces by database id, for resolving a parent without revealing a
   * space the caller cannot see (a parent outside this set is reported as no parent).
   */
  slugById: Map<number, string>;
  /** Chain-derived member counts by on-chain id; present only when governance was read. */
  memberCountByWeb3Id: Map<number, number>;
};

async function listSources(input: ListSpacesInput): Promise<Space[]> {
  const options =
    input.parentOnly !== undefined
      ? { parentOnly: input.parentOnly }
      : undefined;
  if (input.web3SpaceIds) {
    return getSpacesByWeb3Ids(input.web3SpaceIds, options);
  }
  if (input.slugs) return getSpacesBySlugs(input.slugs, options);
  return getAllSpaces({
    search: input.search,
    parentOnly: input.parentOnly,
    omitArchived: input.omitArchived,
    omitSandbox: input.omitSandbox,
  });
}

/**
 * Feature function "list spaces": the viewer-aware list. The access rule runs BEFORE
 * paging and before any aggregate, so `total` and the pages describe only what the caller
 * may see. There is no unfiltered mode.
 */
export async function listSpaces(
  input: ListSpacesInput,
  caller: Caller,
  { db }: DbConfig,
): Promise<{ ok: true; data: ListSpacesData } | Failure> {
  try {
    let spaces = await listSources(input);

    // The omit filters apply on every source (v1 only honours them for the default one).
    if (input.omitFlagArchived) {
      spaces = spaces.filter((space) => !space.flags?.includes('archived'));
    }
    if (input.omitArchived) {
      spaces = spaces.filter((space) => !isSpaceArchived(space));
    }
    if (input.omitSandbox) {
      spaces = spaces.filter(
        (space) => !space.flags?.includes('sandbox' as never),
      );
    }
    if (input.omitEmpty) {
      spaces = spaces.filter((space) => space.memberCount !== 0);
    }

    const { visible, levels, levelsUnreadable } = await filterSpacesForCaller(
      spaces,
      caller,
      { db },
    );
    if (levelsUnreadable) {
      return failure(
        'access_check_failed',
        'Spaces could not be listed right now.',
      );
    }
    spaces = visible;
    if (input.titleOrder) {
      const sign = input.titleOrder === 'desc' ? -1 : 1;
      spaces = [...spaces].sort(
        (a, b) => sign * (a.title ?? '').localeCompare(b.title ?? ''),
      );
    }
    const slugById = new Map(spaces.map((s) => [s.id, s.slug] as const));
    const total = spaces.length;
    if (input.paging) {
      const { page, pageSize } = input.paging;
      spaces = spaces.slice((page - 1) * pageSize, page * pageSize);
    }

    const web3Ids = [
      ...new Set(
        spaces
          .map((s) => s.web3SpaceId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const [governance, clock] = await Promise.all([
      input.with?.governance
        ? readSpaceGovernanceBatch(web3Ids)
        : Promise.resolve(null),
      readChainClock(),
    ]);

    const items = spaces.map((space) => {
      const { memberAddresses: _omitted, ...v1Item } = space;
      void _omitted;
      const out: ListedSpace = { ...v1Item };
      const id = space.web3SpaceId;
      if (input.with?.visibility) {
        const v = typeof id === 'number' ? levels.get(id) : undefined;
        out.visibility = v
          ? { discoverability: v.discoverability, access: v.access }
          : null;
      }
      if (governance) {
        const g = typeof id === 'number' ? governance.get(id) : undefined;
        if (g) {
          const { memberCount: _memberCount, ...rest } = g;
          void _memberCount;
          out.governance = rest;
        } else {
          out.governance = null;
        }
      }
      return out;
    });

    return {
      ok: true,
      data: {
        items,
        total,
        asOf: clock.asOf,
        asOfBlock: clock.asOfBlock,
        slugById,
        memberCountByWeb3Id: new Map(
          [...(governance ?? [])].map(
            ([id, g]) => [id, g.memberCount] as const,
          ),
        ),
      },
    };
  } catch (error) {
    // Includes an access fact that could not be read: the list fails closed.
    console.error('[features] list spaces failed', error);
    return failure(
      'access_check_failed',
      'Spaces could not be listed right now.',
    );
  }
}
