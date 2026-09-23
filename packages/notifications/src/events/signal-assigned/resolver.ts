import { inArray } from 'drizzle-orm';
import { findPersonById, findSpaceById } from '@hypha-platform/core/server';
import {
  getAbsoluteAppUrl,
  getSpaceDhoPath,
} from '@hypha-platform/core/server';
import { db, people } from '@hypha-platform/storage-postgres';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { Recipient, SignalAssignedEvent } from '../../core/types';

export function buildSignalAssignedEvent(input: {
  spaceId: number;
  assigneePersonIds: number[];
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
}): SignalAssignedEvent {
  return {
    type: 'signal.assigned',
    source: {
      kind: 'domain',
      entityType: 'coherence',
      entityId: input.signalSlug,
    },
    context: {
      spaceId: input.spaceId,
      assigneePersonIds: [...new Set(input.assigneePersonIds)].filter(
        (id) => Number.isInteger(id) && id > 0,
      ),
      actorPersonId: input.actorPersonId,
    },
    payload: { signalSlug: input.signalSlug, signalTitle: input.signalTitle },
  };
}

/** Re-derives `notify-signal-assigned.ts`'s prior logic (self-assignment excluded, email only). */
export const resolveSignalAssignedRecipients: RecipientResolver<
  SignalAssignedEvent
> = async (event) => {
  const { spaceId, assigneePersonIds, actorPersonId } = event.context;
  const recipientIds = assigneePersonIds.filter((id) => id !== actorPersonId);
  if (recipientIds.length === 0) return [];

  const [space, actor, assignees] = await Promise.all([
    findSpaceById({ id: spaceId }, { db }),
    actorPersonId
      ? findPersonById({ id: actorPersonId }, { db })
      : Promise.resolve(null),
    db
      .select({ slug: people.slug })
      .from(people)
      .where(inArray(people.id, recipientIds)),
  ]);

  if (!space) {
    console.warn('[notifications] signal.assigned: space not found', {
      spaceId,
    });
    return [];
  }

  const url = getAbsoluteAppUrl(
    `${getSpaceDhoPath(space.slug, 'coherence')}?signal=${encodeURIComponent(
      event.payload.signalSlug,
    )}`,
  );
  const actorDisplayName =
    [actor?.name, actor?.surname].filter(Boolean).join(' ').trim() || undefined;
  const data = { spaceTitle: space.title, actorDisplayName, url };

  const recipients: Recipient[] = [];
  for (const { slug } of assignees) {
    if (!slug) continue;
    recipients.push({ personSlug: slug, role: 'assignee', data });
  }
  return recipients;
};
