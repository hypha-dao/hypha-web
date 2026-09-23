import { getSpaceDetails } from '@hypha-platform/core/client';
import {
  findDocumentsCreatorsForNotifications,
  findDocumentWithSpaceByIdRaw,
  findPeopleByWeb3Addresses,
  web3Client,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type {
  ProposalAcceptedEvent,
  ProposalRejectedEvent,
  Recipient,
} from '../../core/types';

export type ProposalSettlementEvent =
  | ProposalAcceptedEvent
  | ProposalRejectedEvent;

/**
 * Shared between `proposal.accepted` and `proposal.rejected` — same recipient shape (creator +
 * space members), just re-derived from the `apps/web/.../webhooks/proposal/{executed,rejected}`
 * routes' prior inline logic (two separate queries, kept as two separate queries here too,
 * unchanged): `findDocumentsCreatorsForNotifications` for the creator row, and
 * `findDocumentWithSpaceByIdRaw` + an on-chain member read for the members list. Neither webhook
 * ever populated `creatorName` for these two event types (only `proposal.created` does) — no
 * regression, just not adding a name the original queries never fetched.
 */
export const resolveProposalSettlementRecipients: RecipientResolver<
  ProposalSettlementEvent
> = async (event) => {
  const { proposalWeb3Id } = event.context;
  const recipients: Recipient[] = [];

  const [creatorRow] = await findDocumentsCreatorsForNotifications(
    { proposalIds: [proposalWeb3Id] },
    { db },
  );

  if (creatorRow?.slug) {
    recipients.push({
      personSlug: creatorRow.slug,
      role: 'creator',
      data: {
        spaceTitle: creatorRow.spaceTitle,
        proposalTitle: creatorRow.proposalTitle ?? undefined,
        proposalLabel: creatorRow.proposalLabel ?? undefined,
        proposalState: creatorRow.proposalState ?? undefined,
      },
    });
  } else {
    console.warn(
      `[notifications] ${event.type}: creator not found for proposal`,
      {
        proposalWeb3Id,
      },
    );
  }

  const proposal = await findDocumentWithSpaceByIdRaw(
    { id: proposalWeb3Id },
    { db },
  );
  if (!proposal) {
    console.warn(`[notifications] ${event.type}: proposal/space not found`, {
      proposalWeb3Id,
    });
    return recipients;
  }

  const { document, space } = proposal;
  const spaceWeb3Id = space.web3SpaceId;
  if (!spaceWeb3Id) return recipients;

  const spaceDetails = await (async () => {
    try {
      return await web3Client.readContract(
        getSpaceDetails({ spaceId: BigInt(spaceWeb3Id) }),
      );
    } catch (error) {
      console.error(
        `[notifications] ${event.type}: failed to read space members on-chain`,
        error,
      );
      return undefined;
    }
  })();
  if (!spaceDetails) return recipients;

  // TODO: fix type (carried over from the webhook route this replaced)
  const memberAddresses = spaceDetails.at(4) as `0x${string}`[];
  const members = await findPeopleByWeb3Addresses(
    { addresses: memberAddresses },
    { db },
  );

  const memberData = {
    spaceTitle: space.title,
    proposalTitle: document.title ?? undefined,
    proposalLabel: document.label ?? undefined,
    proposalState: document.state ?? undefined,
  };

  for (const member of members) {
    if (!member.slug || member.slug === creatorRow?.slug) continue;
    recipients.push({
      personSlug: member.slug,
      role: 'member',
      data: memberData,
    });
  }

  return recipients;
};
