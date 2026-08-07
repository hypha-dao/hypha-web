import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { campaignGrants, campaignMembers, db, type CampaignGrant } from '../db';

import type { ContributionDto } from '@rs/lib/campaign-types';

import { campaignConfig } from '../config';
import { findHyphaProfiles } from '../hypha-profiles';
import { getOpenCycle } from './cycles';
import { numeric, recordGrant, settleMint } from './grants';
import type { PaymentEvent } from '../payments';

/**
 * Turns a settled payment into voting power.
 *
 * The idempotency key is `provider:providerReference`, so a webhook Paddle or
 * Stripe retries five times still produces exactly one grant and at most one
 * mint. The reference we generated at checkout is only used to find the
 * member — it is never the uniqueness key, because a provider can legitimately
 * emit several events for one checkout.
 */
export async function applyPaymentEvent(
  event: PaymentEvent,
  provider: string,
): Promise<{ handled: boolean; reason?: string }> {
  if (event.type !== 'payment.completed') {
    return { handled: false, reason: `Ignoring ${event.type}` };
  }
  if (!(event.amountCents > 0)) {
    return { handled: false, reason: 'Zero amount' };
  }

  const memberId = memberIdFromReference(event.reference);
  const member = memberId
    ? await db.query.campaignMembers.findFirst({
        where: eq(campaignMembers.id, memberId),
      })
    : event.email
    ? await db.query.campaignMembers.findFirst({
        where: eq(campaignMembers.email, event.email.toLowerCase()),
      })
    : null;

  if (!member) {
    return {
      handled: false,
      reason: `No member for reference ${event.reference ?? '(none)'}`,
    };
  }

  const cycle = await getOpenCycle();
  const rsut = (event.amountCents / 100) * campaignConfig.rsutPerAud;

  const { grant, created } = await recordGrant({
    memberId: member.id,
    kind: 'contribution',
    idempotencyKey: `${provider}:${event.providerReference}`,
    rsut,
    audCents: event.amountCents,
    cycleId: cycle?.id ?? null,
    paymentProvider: provider,
    paymentReference: event.providerReference,
    paymentStatus: 'settled',
  });

  if (!created) return { handled: true, reason: 'Already processed' };

  await settleMint(grant);
  return { handled: true };
}

/** Checkout references are minted as `rs_<memberId>_<time>_<random>`. */
function memberIdFromReference(reference: string | null): number | null {
  if (!reference) return null;
  const match = /^rs_(\d+)_/.exec(reference);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) ? id : null;
}

function toContributionDto(
  grant: CampaignGrant,
  who: string,
  email: string | null,
  hypha: ContributionDto['hypha'],
): ContributionDto {
  return {
    id: grant.id,
    who,
    email,
    amountAud: grant.audCents / 100,
    rsut: numeric(grant.rsut),
    at: grant.createdAt.toISOString(),
    status: grant.paymentStatus,
    mintStatus: grant.mintStatus,
    mintTxHash: grant.mintTxHash,
    kind: grant.kind,
    hypha,
  };
}

/**
 * The admin ledger. Contributors who also have a Hypha profile are annotated
 * with it, looked up read-only over Hypha's public API — see
 * server/hypha-profiles.ts. That lookup is best-effort: if Hypha is slow or
 * unreachable the ledger simply shows what the campaign knows on its own.
 */
export async function listContributions(limit = 200) {
  const rows = await db
    .select({ grant: campaignGrants, member: campaignMembers })
    .from(campaignGrants)
    .innerJoin(campaignMembers, eq(campaignGrants.memberId, campaignMembers.id))
    .orderBy(desc(campaignGrants.createdAt))
    .limit(limit);

  const profiles = await findHyphaProfiles(
    rows.map(({ member }) => member.walletAddress),
  );

  return rows.map(({ grant, member }) => {
    const profile = member.walletAddress
      ? profiles.get(member.walletAddress.toLowerCase()) ?? null
      : null;

    return toContributionDto(
      grant,
      profile?.name || member.name || member.email || 'Member',
      member.email,
      profile ? { name: profile.name, url: profile.url } : null,
    );
  });
}
