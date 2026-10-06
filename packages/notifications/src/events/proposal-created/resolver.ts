import { fetchSpaceDetails } from '@hypha-platform/core/client';
import {
  findPeopleByWeb3Addresses,
  findPersonByWeb3Address,
  findSpaceByWeb3Id,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { ProposalCreatedEvent, Recipient } from '../../core/types';

export function buildProposalCreatedEvent(input: {
  proposalId: bigint;
  spaceId: bigint;
  creator: `0x${string}`;
  proposalLabel?: string;
}): ProposalCreatedEvent {
  return {
    type: 'proposal.created',
    source: {
      kind: 'domain',
      entityType: 'proposal',
      entityId: input.proposalId.toString(),
    },
    context: {
      proposalWeb3Id: input.proposalId,
      spaceWeb3Id: input.spaceId,
      creatorWeb3Address: input.creator,
    },
    payload: { proposalLabel: input.proposalLabel },
  };
}

/** Re-derives the proposal-created webhook route's prior recipient logic (unchanged), just returning `Recipient[]` instead of sending. */
export const resolveProposalCreatedRecipients: RecipientResolver<
  ProposalCreatedEvent
> = async (event) => {
  const { proposalWeb3Id, spaceWeb3Id, creatorWeb3Address } = event.context;

  const [creatorPerson, space] = await Promise.all([
    findPersonByWeb3Address({ address: creatorWeb3Address }, { db }),
    findSpaceByWeb3Id({ id: Number(spaceWeb3Id) }, { db }),
  ]);

  const recipients: Recipient[] = [];
  const spaceTitle = space?.title ?? '';
  const creatorName = creatorPerson?.name;

  if (creatorPerson?.slug && space) {
    recipients.push({
      personSlug: creatorPerson.slug,
      displayName: creatorName,
      role: 'creator',
      data: { spaceTitle },
    });
  } else {
    console.warn(
      '[notifications] proposal.created: creator or space not found',
      {
        creatorWeb3Address,
        spaceWeb3Id,
      },
    );
  }

  const spacesDetails = await (async () => {
    try {
      return await fetchSpaceDetails({ spaceIds: [spaceWeb3Id] });
    } catch (error) {
      console.error(
        '[notifications] failed to fetch space details for proposal.created',
        error,
      );
      return undefined;
    }
  })();

  const spaceDetail = spacesDetails?.[0];
  if (!spaceDetail) {
    console.warn(
      '[notifications] proposal.created: zero spaces found on-chain',
      {
        proposalWeb3Id,
      },
    );
    return recipients;
  }

  const normalizedCreator = creatorWeb3Address.toUpperCase();
  const memberAddresses = spaceDetail.members.filter(
    (address) => address.toUpperCase() !== normalizedCreator,
  ) as string[];
  const members = await findPeopleByWeb3Addresses(
    { addresses: memberAddresses },
    { db },
  );

  for (const member of members) {
    if (!member.slug) continue;
    recipients.push({
      personSlug: member.slug,
      role: 'member',
      data: { spaceTitle, creatorName },
    });
  }

  return recipients;
};
