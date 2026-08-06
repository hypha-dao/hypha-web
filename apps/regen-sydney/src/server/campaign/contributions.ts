import 'server-only';

import { desc, eq } from 'drizzle-orm';
import {
  campaignGrants,
  db,
  people,
  type CampaignGrant,
} from '@hypha-platform/storage-postgres';

import type { ContributionDto } from '@rs/lib/campaign-types';

import { campaignConfig } from '../config';
import { getOpenCycle } from './cycles';
import { numeric, recordGrant, settleMint } from './grants';
import type { PaymentEvent } from '../payments';

/**
 * Turns a settled payment into voting power.
 *
 * The idempotency key is `provider:providerReference`, so a webhook Paddle or
 * Stripe retries five times still produces exactly one grant and at most one
 * mint. The reference we generated at checkout is only used to find the
 * person — it is never the uniqueness key, because a provider can legitimately
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

  const personId = personIdFromReference(event.reference);
  const person = personId
    ? await db.query.people.findFirst({ where: eq(people.id, personId) })
    : event.email
    ? await db.query.people.findFirst({
        where: eq(people.email, event.email.toLowerCase()),
      })
    : null;

  if (!person) {
    return {
      handled: false,
      reason: `No person for reference ${event.reference ?? '(none)'}`,
    };
  }

  const cycle = await getOpenCycle();
  const rsut = (event.amountCents / 100) * campaignConfig.rsutPerAud;

  const { grant, created } = await recordGrant({
    personId: person.id,
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

/** Checkout references are minted as `rs_<personId>_<time>_<random>`. */
function personIdFromReference(reference: string | null): number | null {
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
  };
}

export async function listContributions(limit = 200) {
  const rows = await db
    .select({ grant: campaignGrants, person: people })
    .from(campaignGrants)
    .innerJoin(people, eq(campaignGrants.personId, people.id))
    .orderBy(desc(campaignGrants.createdAt))
    .limit(limit);

  return rows.map(({ grant, person }) =>
    toContributionDto(
      grant,
      [person.name, person.surname].filter(Boolean).join(' ') ||
        person.nickname ||
        person.email ||
        'Member',
      person.email,
    ),
  );
}
