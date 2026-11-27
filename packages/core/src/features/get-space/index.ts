import 'server-only';

import type { ReadCtx } from '../../data-access/types';
import {
  findSpaceById,
  findSpaceHostFieldsBySlug,
  findSpaceWithSubspacesBySlug,
} from '../../data-access/spaces';
import {
  readChainClock,
  readSpaceGovernanceBatch,
  readSpaceVisibilityBatch,
  type SpaceGovernance,
  type SpaceVisibility,
} from '../../access/chain-reads';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess, filterSpacesForCaller } from '../../access/policy';
import type { Space } from '../../space/types';

export type GetSpaceInput = {
  slug: string;
  /** Optional blocks: each one that cannot be read comes back `null`, never a failed call. */
  with?: { governance?: boolean; visibility?: boolean; counts?: boolean };
};

/**
 * A space as a feature returns it: stored fields only. Wallet addresses (the member list, the
 * space and creator addresses), the member rows, the documents and the chat room are never
 * part of it; a presentation cannot forget to drop them.
 */
export type SpaceFacts = Omit<
  Space,
  | 'memberAddresses'
  | 'members'
  | 'documents'
  | 'address'
  | 'creatorAddress'
  | 'chatRoomId'
  | 'subspaces'
>;

export type SpaceDetail = SpaceFacts & {
  /** Only the sub-spaces this caller may see (the list rule, applied here). */
  subspaces: SpaceFacts[];
  /** Slug of the parent, only when the caller may see the parent; otherwise `null`. */
  parentSlug: string | null;
  visibility?: Pick<SpaceVisibility, 'discoverability' | 'access'> | null;
  governance?: Omit<SpaceGovernance, 'memberCount'> | null;
  /** `null` = unknown (no on-chain id or the read failed), never a silent 0. */
  counts?: { memberCount: number | null };
  asOf: string;
  asOfBlock: number | null;
};

function toFacts(space: Space): SpaceFacts {
  const {
    memberAddresses: _a,
    members: _m,
    documents: _d,
    address: _ad,
    creatorAddress: _c,
    chatRoomId: _r,
    subspaces: _s,
    ...facts
  } = space;
  void [_a, _m, _d, _ad, _c, _r, _s];
  return facts;
}

/** A parent the caller cannot see (or that cannot be read) is reported as no parent. */
async function visibleParentSlug(
  parentId: number | null | undefined,
  ctx: ReadCtx,
): Promise<string | null> {
  if (parentId == null) return null;
  try {
    const parent = await findSpaceById(ctx, { id: parentId });
    if (!parent) return null;
    const { visible } = await filterSpacesForCaller([parent], ctx);
    return visible[0]?.slug ?? null;
  } catch (error) {
    console.error('[features] parent lookup failed', error);
    return null;
  }
}

/**
 * Feature function "get space": one space the caller may see. The access policy runs on the
 * light host lookup BEFORE the heavy load; a space the caller may not see is `not_found`,
 * the same answer as an unknown slug.
 */
export async function getSpace(
  { slug, with: blocks = {} }: GetSpaceInput,
  ctx: ReadCtx,
): Promise<{ ok: true; data: SpaceDetail } | Failure> {
  try {
    const host = await findSpaceHostFieldsBySlug(ctx, { slug });
    if (!host) return failure('not_found', 'Space not found');

    const decision = await decideSpaceAccess(host, ctx);
    if (decision.outcome === 'none') {
      return decision.failure.code === 'access_check_failed'
        ? decision.failure
        : failure('not_found', 'Space not found');
    }

    const space = await findSpaceWithSubspacesBySlug(ctx, { slug });
    // The access decision was made on `host`; the loaded space must be that same space.
    if (!space || space.id !== host.id) {
      return failure('not_found', 'Space not found');
    }

    const id = typeof space.web3SpaceId === 'number' ? space.web3SpaceId : null;
    const wantsGovernance =
      blocks.governance === true || blocks.counts === true;

    // The access check passed: an optional block whose chain read is rejected is `null`
    // (unknown), never a failed request and never a silent 0.
    const optional = <T>(read: Promise<T>): Promise<T | null> =>
      read.catch((error) => {
        console.error('[features] optional chain read failed', error);
        return null;
      });
    const [visibility, governance, clock, siblings, parentSlug] =
      await Promise.all([
        blocks.visibility === true && id !== null
          ? optional(readSpaceVisibilityBatch([id]))
          : Promise.resolve(null),
        wantsGovernance && id !== null
          ? optional(readSpaceGovernanceBatch([id]))
          : Promise.resolve(null),
        readChainClock(),
        filterSpacesForCaller(space.subspaces ?? [], ctx),
        visibleParentSlug(space.parentId, ctx),
      ]);
    // The sub-spaces leave the feature filtered per caller, like any list.
    if (siblings.levelsUnreadable) {
      return failure(
        'access_check_failed',
        'The space could not be read right now.',
      );
    }

    const out: SpaceDetail = {
      ...toFacts(space),
      subspaces: siblings.visible.map(toFacts),
      parentSlug,
      asOf: clock.asOf,
      asOfBlock: clock.asOfBlock,
    };
    const v = id !== null ? visibility?.get(id) : undefined;
    const g = id !== null ? governance?.get(id) : undefined;
    if (blocks.visibility === true) {
      out.visibility = v
        ? { discoverability: v.discoverability, access: v.access }
        : null;
    }
    if (blocks.governance === true) {
      if (g) {
        const { memberCount: _memberCount, ...rest } = g;
        void _memberCount;
        out.governance = rest;
      } else {
        out.governance = null;
      }
    }
    if (blocks.counts === true) {
      out.counts = { memberCount: g ? g.memberCount : null };
    }
    return { ok: true, data: out };
  } catch (error) {
    console.error('[features] get space failed', error);
    return failure(
      'access_check_failed',
      'The space could not be read right now.',
    );
  }
}
