import 'server-only';

import type { ReadCtx } from '../../data-access/types';
import {
  listAllSpaces,
  listSpacesBySlugs,
  listSpacesByWeb3Ids,
} from '../../data-access/spaces';
import {
  readChainClock,
  readSpaceGovernanceBatch,
  type SpaceGovernance,
  type SpaceVisibility,
} from '../../access/chain-reads';
import { failure, type Failure } from '../../access/failure';
import { filterSpacesForCaller } from '../../access/policy';
import { getViewerSpaceIds } from '../../access/viewer-access';
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
  /**
   * Keep only the spaces where the caller is a member, or a delegate with a member delegator.
   * Applied AFTER the access policy (it narrows what the caller may see, never widens it) and
   * before ordering and paging, so `total` counts the narrowed set. Needs a verified user with
   * a wallet address; unreadable membership fails the call.
   */
  mine?: boolean;
  /**
   * Fail instead of returning a list that may be missing spaces because a fact about the
   * caller's spaces could not be read. Independent of `mine` (a filter): the channel decides
   * whether to ask for it. Without it the list hides what it cannot read.
   */
  authoritative?: boolean;
  /** Sort by title after the filters; unset keeps the source order. */
  titleOrder?: 'asc' | 'desc';
  /** Both absent = the full list. The channel normalises and caps these. */
  paging?: { offset: number; limit: number };
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

async function listSources(
  input: ListSpacesInput,
  ctx: ReadCtx,
): Promise<Space[]> {
  const options =
    input.parentOnly !== undefined
      ? { parentOnly: input.parentOnly }
      : undefined;
  if (input.web3SpaceIds) {
    return listSpacesByWeb3Ids(ctx, input.web3SpaceIds, options);
  }
  if (input.slugs) return listSpacesBySlugs(ctx, input.slugs, options);
  return listAllSpaces(ctx, {
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
  ctx: ReadCtx,
): Promise<{ ok: true; data: ListSpacesData } | Failure> {
  const caller = ctx.actor;
  try {
    let spaces = await listSources(input, ctx);

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
      ctx,
    );
    if (levelsUnreadable) {
      return failure(
        'access_check_failed',
        'Spaces could not be listed right now.',
      );
    }
    spaces = visible;
    // `slugById` stays the whole visible set: a visible parent can be named even when only a
    // child is "mine".
    const slugById = new Map(spaces.map((s) => [s.id, s.slug] as const));
    if (input.mine) {
      if (caller.kind !== 'user') {
        return failure('unauthenticated', 'A verified user is required.');
      }
      if (!caller.address) {
        return failure('invalid_identity', 'Could not verify your identity.');
      }
    }
    if (
      (input.mine || input.authoritative) &&
      caller.kind === 'user' &&
      caller.address
    ) {
      // One bulk read of the person's spaces (not one read per listed space). `null` means it
      // could not be read: an error, never an empty list that looks like "no memberships".
      const viewer = await getViewerSpaceIds(caller.address);
      if (!viewer || (input.authoritative && !viewer.complete)) {
        return failure(
          'access_check_failed',
          'Spaces could not be listed right now.',
        );
      }
      if (input.mine) {
        spaces = spaces.filter(
          (space) =>
            typeof space.web3SpaceId === 'number' &&
            viewer.ids.has(space.web3SpaceId),
        );
      }
    }
    if (input.titleOrder) {
      const sign = input.titleOrder === 'desc' ? -1 : 1;
      spaces = [...spaces].sort(
        (a, b) => sign * (a.title ?? '').localeCompare(b.title ?? ''),
      );
    }
    const total = spaces.length;
    if (input.paging) {
      const { offset, limit } = input.paging;
      spaces = spaces.slice(offset, offset + limit);
    }

    const web3Ids = [
      ...new Set(
        spaces
          .map((s) => s.web3SpaceId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    // An optional block: a rejected read gives `null` for each space, never a failed list.
    const wantsGovernance = input.with?.governance === true;
    const [governance, clock] = await Promise.all([
      wantsGovernance
        ? readSpaceGovernanceBatch(web3Ids).catch((error) => {
            console.error('[features] governance read failed', error);
            return null;
          })
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
      if (wantsGovernance) {
        const g = typeof id === 'number' ? governance?.get(id) : undefined;
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
