import { and, eq, inArray, isNull } from 'drizzle-orm';
import { spaceMemberInvites, spaces } from '@hypha-platform/storage-postgres';

import type { DbConfig } from '../../common/server/types';
import { isUniqueViolation } from '../../common/server/unique-violation';
import { web3Client } from '../../common/server/web3-rpc/client';
import { findPersonById } from '../../people/server/queries';
import { SPACE_ACTOR_SUB_PREFIX } from '../../people/server/space-actor-person';
import { isMember as isMemberConfig } from '../client/web3/dao-space-factory/is-member';
import { splitInvitesByMembership } from '../space-member-invite';

export type SpaceMemberInviteLink = {
  id: number;
  token: string;
  spaceId: number;
  web3SpaceId: number | null;
  spaceSlug: string;
  spaceTitle: string;
};

export type CreateSpaceMemberInviteResult =
  | {
      ok: true;
      invite: SpaceMemberInviteLink & {
        inviteeSlug: string | null;
        alreadyPending: boolean;
      };
    }
  | {
      ok: false;
      reason:
        | 'space-not-found'
        | 'not-member'
        | 'membership-unknown'
        | 'invitee-not-found'
        | 'self'
        | 'already-member';
    };

const PENDING_CONSTRAINT = 'space_member_invite_pending_idx';

function asAddress(value: string | null | undefined): `0x${string}` | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed as `0x${string}`;
}

async function readIsMember(
  web3SpaceId: number,
  address: `0x${string}`,
): Promise<boolean | null> {
  try {
    const member = await web3Client.readContract(
      isMemberConfig({
        spaceId: BigInt(web3SpaceId),
        memberAddress: address,
      }),
    );
    return Boolean(member);
  } catch (error) {
    console.error('[space-member-invite] membership read failed', error);
    return null;
  }
}

async function findPendingInvite(
  { spaceId, inviteePersonId }: { spaceId: number; inviteePersonId: number },
  { db }: DbConfig,
) {
  const [row] = await db
    .select({
      id: spaceMemberInvites.id,
      token: spaceMemberInvites.token,
    })
    .from(spaceMemberInvites)
    .where(
      and(
        eq(spaceMemberInvites.spaceId, spaceId),
        eq(spaceMemberInvites.inviteePersonId, inviteePersonId),
        isNull(spaceMemberInvites.acceptedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createSpaceMemberInvite(
  {
    spaceSlug,
    inviterPersonId,
    inviterAddress,
    inviteePersonId,
  }: {
    spaceSlug: string;
    inviterPersonId: number;
    inviterAddress: string | null | undefined;
    inviteePersonId: number;
  },
  { db }: DbConfig,
): Promise<CreateSpaceMemberInviteResult> {
  if (inviterPersonId === inviteePersonId) {
    return { ok: false, reason: 'self' };
  }

  const [space] = await db
    .select({
      id: spaces.id,
      slug: spaces.slug,
      title: spaces.title,
      web3SpaceId: spaces.web3SpaceId,
      isArchived: spaces.isArchived,
    })
    .from(spaces)
    .where(eq(spaces.slug, spaceSlug))
    .limit(1);
  if (!space || space.isArchived) {
    return { ok: false, reason: 'space-not-found' };
  }
  const web3SpaceId = space.web3SpaceId;
  const inviterWallet = asAddress(inviterAddress);
  if (
    typeof web3SpaceId !== 'number' ||
    !Number.isInteger(web3SpaceId) ||
    web3SpaceId <= 0 ||
    !inviterWallet
  ) {
    return { ok: false, reason: 'not-member' };
  }

  const inviterIsMember = await readIsMember(web3SpaceId, inviterWallet);
  if (inviterIsMember === null) {
    return { ok: false, reason: 'membership-unknown' };
  }
  if (!inviterIsMember) {
    return { ok: false, reason: 'not-member' };
  }

  const invitee = await findPersonById({ id: inviteePersonId }, { db });
  if (!invitee?.id || invitee.sub?.startsWith(SPACE_ACTOR_SUB_PREFIX)) {
    return { ok: false, reason: 'invitee-not-found' };
  }

  const inviteeWallet = asAddress(invitee.address);
  if (inviteeWallet) {
    const inviteeIsMember = await readIsMember(web3SpaceId, inviteeWallet);
    if (inviteeIsMember === null) {
      return { ok: false, reason: 'membership-unknown' };
    }
    if (inviteeIsMember) {
      return { ok: false, reason: 'already-member' };
    }
  }

  const existing = await findPendingInvite(
    { spaceId: space.id, inviteePersonId: invitee.id },
    { db },
  );
  if (existing) {
    return {
      ok: true,
      invite: {
        id: existing.id,
        token: existing.token,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        inviteeSlug: invitee.slug ?? null,
        alreadyPending: true,
      },
    };
  }

  try {
    const token = crypto.randomUUID().replace(/-/g, '');
    const [created] = await db
      .insert(spaceMemberInvites)
      .values({
        spaceId: space.id,
        inviterPersonId,
        inviteePersonId: invitee.id,
        token,
      })
      .returning();
    if (!created) {
      return { ok: false, reason: 'invitee-not-found' };
    }
    return {
      ok: true,
      invite: {
        id: created.id,
        token: created.token,
        spaceId: space.id,
        web3SpaceId: space.web3SpaceId ?? null,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        inviteeSlug: invitee.slug ?? null,
        alreadyPending: false,
      },
    };
  } catch (error) {
    if (!isUniqueViolation(error, PENDING_CONSTRAINT)) throw error;
    const raced = await findPendingInvite(
      { spaceId: space.id, inviteePersonId: invitee.id },
      { db },
    );
    if (!raced) throw error;
    return {
      ok: true,
      invite: {
        id: raced.id,
        token: raced.token,
        spaceId: space.id,
        web3SpaceId: space.web3SpaceId ?? null,
        spaceSlug: space.slug,
        spaceTitle: space.title,
        inviteeSlug: invitee.slug ?? null,
        alreadyPending: true,
      },
    };
  }
}

export async function listPendingSpaceMemberInvites(
  {
    personId,
    memberSpaceIds,
  }: { personId: number; memberSpaceIds: readonly number[] },
  { db }: DbConfig,
): Promise<SpaceMemberInviteLink[]> {
  const rows = await db
    .select({
      id: spaceMemberInvites.id,
      token: spaceMemberInvites.token,
      spaceId: spaces.id,
      web3SpaceId: spaces.web3SpaceId,
      spaceSlug: spaces.slug,
      spaceTitle: spaces.title,
    })
    .from(spaceMemberInvites)
    .innerJoin(spaces, eq(spaceMemberInvites.spaceId, spaces.id))
    .where(
      and(
        eq(spaceMemberInvites.inviteePersonId, personId),
        isNull(spaceMemberInvites.acceptedAt),
        eq(spaces.isArchived, false),
      ),
    );

  const { pending, joinedInviteIds } = splitInvitesByMembership(
    rows,
    new Set(memberSpaceIds),
  );

  if (joinedInviteIds.length > 0) {
    const now = new Date();
    await db
      .update(spaceMemberInvites)
      .set({ acceptedAt: now, updatedAt: now })
      .where(inArray(spaceMemberInvites.id, joinedInviteIds));
  }

  return pending.map((row) => ({
    id: row.id,
    token: row.token,
    spaceId: row.spaceId,
    web3SpaceId: row.web3SpaceId ?? null,
    spaceSlug: row.spaceSlug,
    spaceTitle: row.spaceTitle,
  }));
}
