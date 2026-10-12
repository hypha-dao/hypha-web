import {
  findPersonByWeb3Address,
  getAbsoluteAppUrl,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { buildNotificationSettingsUrl } from '../../core/notification-settings-url';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { Recipient, SpaceCreatedEvent } from '../../core/types';

export function buildSpaceCreatedEvent(input: {
  creator: `0x${string}`;
  spacesCount: number;
  /** Web3 space ids of this creator's spaces in the batch — only used for the event's identity. */
  spaceIds?: bigint[];
}): SpaceCreatedEvent {
  return {
    type: 'space.created',
    source: {
      kind: 'domain',
      entityType: 'space',
      entityId: input.spaceIds?.map(String).join(',') ?? input.creator,
    },
    context: { creatorWeb3Address: input.creator },
    payload: { spacesCount: input.spacesCount },
  };
}

/**
 * The creator is the only recipient. Re-derives the space-created webhook route's prior lookup
 * (`findPersonByWeb3Address`), returning a `Recipient` instead of sending.
 */
export const resolveSpaceCreatedRecipients: RecipientResolver<
  SpaceCreatedEvent
> = async (event) => {
  const { creatorWeb3Address } = event.context;
  const person = await findPersonByWeb3Address(
    { address: creatorWeb3Address },
    { db },
  );
  if (!person?.slug) {
    console.warn('[notifications] space.created: creator not found', {
      creatorWeb3Address,
    });
    return [];
  }

  const recipient: Recipient = {
    personSlug: person.slug,
    displayName: person.name,
    role: 'creator',
    data: {
      spacesCount: event.payload.spacesCount,
      url: getAbsoluteAppUrl('/en/my-spaces'),
      notificationSettingsUrl: buildNotificationSettingsUrl(),
    },
  };
  return [recipient];
};
