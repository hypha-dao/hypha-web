import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  campaignGrants,
  campaignMembers,
  db,
  type CampaignGrant,
  type CampaignMember,
} from '../db';

import { campaignConfig } from '../config';
import { mintRsut } from '../chain/rsut';

/**
 * The grants ledger is the source of truth for voting power. Every grant row
 * is written *before* its on-chain mint is attempted, so a mint that fails,
 * times out, or hits an unauthorised relayer can be retried later without any
 * risk of granting twice. That ordering is the single most important
 * invariant in this app.
 */

export type GrantInput = {
  memberId: number;
  kind: 'join' | 'contribution' | 'manual';
  /** Must be stable for a given real-world event: replaying it is a no-op. */
  idempotencyKey: string;
  rsut: number;
  audCents?: number;
  cycleId?: number | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  paymentStatus?: 'pending' | 'settled' | 'refunded' | 'cancelled';
  note?: string | null;
};

export type RecordGrantResult = {
  grant: CampaignGrant;
  created: boolean;
};

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Inserts the grant, or returns the existing row if this key was already used.
 * The uniqueness of `idempotency_key` is what makes a replayed payment webhook
 * safe, so the insert deliberately relies on the constraint rather than on a
 * read-then-write check that could race.
 */
export async function recordGrant(
  input: GrantInput,
): Promise<RecordGrantResult> {
  const member = await db.query.campaignMembers.findFirst({
    where: eq(campaignMembers.id, input.memberId),
  });

  const inserted = await db
    .insert(campaignGrants)
    .values({
      memberId: input.memberId,
      cycleId: input.cycleId ?? null,
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      rsut: input.rsut.toFixed(6),
      audCents: input.audCents ?? 0,
      paymentProvider: input.paymentProvider ?? null,
      paymentReference: input.paymentReference ?? null,
      paymentStatus: input.paymentStatus ?? 'settled',
      mintToAddress: member?.walletAddress ?? null,
      mintStatus: 'pending',
      note: input.note ?? null,
    })
    .onConflictDoNothing({ target: campaignGrants.idempotencyKey })
    .returning();

  if (inserted[0]) return { grant: inserted[0], created: true };

  const existing = await db.query.campaignGrants.findFirst({
    where: eq(campaignGrants.idempotencyKey, input.idempotencyKey),
  });
  if (!existing) {
    throw new Error(`Grant ${input.idempotencyKey} vanished after conflict`);
  }
  return { grant: existing, created: false };
}

/**
 * Attempts the on-chain mirror of a grant and records the outcome. Safe to
 * call repeatedly: confirmed grants are left alone.
 */
export async function settleMint(grant: CampaignGrant): Promise<CampaignGrant> {
  if (grant.mintStatus === 'confirmed') return grant;

  const to = grant.mintToAddress ?? (await resolveWallet(grant.memberId));
  if (!to) {
    return updateMint(grant.id, {
      mintStatus: 'skipped',
      mintError: 'No wallet address on record',
    });
  }

  const outcome = await mintRsut({ to, rsut: toNumber(grant.rsut) });

  switch (outcome.status) {
    case 'confirmed':
    case 'sent':
      return updateMint(grant.id, {
        mintStatus: outcome.status,
        mintTxHash: outcome.txHash,
        mintToAddress: to,
        mintError: null,
      });
    case 'skipped':
      return updateMint(grant.id, {
        mintStatus: 'skipped',
        mintToAddress: to,
        mintError: outcome.reason,
      });
    case 'failed':
      return updateMint(grant.id, {
        mintStatus: 'failed',
        mintToAddress: to,
        mintError: outcome.reason,
      });
  }
}

async function resolveWallet(memberId: number): Promise<string | null> {
  const member = await db.query.campaignMembers.findFirst({
    where: eq(campaignMembers.id, memberId),
  });
  return member?.walletAddress ?? null;
}

async function updateMint(
  grantId: number,
  patch: Partial<
    Pick<
      CampaignGrant,
      'mintStatus' | 'mintTxHash' | 'mintError' | 'mintToAddress'
    >
  >,
): Promise<CampaignGrant> {
  const [updated] = await db
    .update(campaignGrants)
    .set({
      ...patch,
      mintAttempts: sql`${campaignGrants.mintAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(campaignGrants.id, grantId))
    .returning();

  if (!updated) throw new Error(`Grant ${grantId} disappeared while minting`);
  return updated;
}

/**
 * Grants the first-login bonus. The idempotency key is derived from the member
 * alone, so concurrent first requests collapse to one grant.
 */
export async function grantJoinBonus(member: CampaignMember): Promise<{
  grant: CampaignGrant | null;
  joinedNow: boolean;
}> {
  const amount = campaignConfig.joinBonusRsut;
  if (!(amount > 0)) return { grant: null, joinedNow: false };

  const { grant, created } = await recordGrant({
    memberId: member.id,
    kind: 'join',
    idempotencyKey: `join:${member.id}`,
    rsut: amount,
    note: 'Joining bonus',
  });

  if (!created) return { grant, joinedNow: false };

  const settled = await settleMint(grant);
  return { grant: settled, joinedNow: true };
}

/** Voting power: every settled grant a member holds, in RSUT. */
export async function getVotingPower(memberId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${campaignGrants.rsut}), 0)`,
    })
    .from(campaignGrants)
    .where(
      and(
        eq(campaignGrants.memberId, memberId),
        inArray(campaignGrants.paymentStatus, ['settled', 'pending']),
      ),
    );

  return toNumber(row?.total);
}

export async function getLatestGrant(
  memberId: number,
): Promise<CampaignGrant | null> {
  const grant = await db.query.campaignGrants.findFirst({
    where: eq(campaignGrants.memberId, memberId),
    orderBy: (grants, { desc }) => [desc(grants.createdAt)],
  });
  return grant ?? null;
}

/** Re-attempts every grant whose mint has not landed. Used by the admin sweep. */
export async function retryPendingMints(limit = 25): Promise<{
  attempted: number;
  confirmed: number;
  failed: number;
}> {
  const pending = await db.query.campaignGrants.findMany({
    where: inArray(campaignGrants.mintStatus, [
      'pending',
      'failed',
      'skipped',
      'sent',
    ]),
    orderBy: (grants, { asc }) => [asc(grants.createdAt)],
    limit,
  });

  let confirmed = 0;
  let failed = 0;

  for (const grant of pending) {
    const settled = await settleMint(grant);
    if (settled.mintStatus === 'confirmed') confirmed += 1;
    else if (settled.mintStatus === 'failed') failed += 1;
  }

  return { attempted: pending.length, confirmed, failed };
}

export { toNumber as numeric };
