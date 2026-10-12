import { inArray } from 'drizzle-orm';
import { findPersonById, findSpaceById } from '@hypha-platform/core/server';
import {
  getAbsoluteAppUrl,
  getSpaceDhoPath,
} from '@hypha-platform/core/server';
import { db, people } from '@hypha-platform/storage-postgres';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type {
  Recipient,
  SignalBoardNoticeEvent,
  SignalBoardNoticeKind,
} from '../../core/types';

export function buildSignalNoticeEvent(input: {
  kind: SignalBoardNoticeKind;
  spaceId: number;
  recipientPersonIds: number[];
  actorPersonId: number | null;
  signalSlug: string;
  signalTitle: string;
  dueAt?: Date | string | null;
  mentionExcerpt?: string;
}): SignalBoardNoticeEvent {
  const dueAt =
    input.dueAt == null
      ? null
      : input.dueAt instanceof Date
      ? input.dueAt.toISOString()
      : input.dueAt;
  return {
    type: 'signal.notice',
    source: {
      kind: 'domain',
      entityType: 'coherence',
      entityId: input.signalSlug,
    },
    context: {
      spaceId: input.spaceId,
      recipientPersonIds: [...new Set(input.recipientPersonIds)].filter(
        (id) => Number.isInteger(id) && id > 0,
      ),
      actorPersonId: input.actorPersonId,
      kind: input.kind,
    },
    payload: {
      signalSlug: input.signalSlug,
      signalTitle: input.signalTitle,
      dueAt,
      mentionExcerpt: input.mentionExcerpt,
    },
  };
}

export const resolveSignalNoticeRecipients: RecipientResolver<
  SignalBoardNoticeEvent
> = async (event) => {
  const { spaceId, recipientPersonIds, actorPersonId } = event.context;
  const recipientIds = recipientPersonIds.filter((id) => id !== actorPersonId);
  if (recipientIds.length === 0) return [];

  const [space, actor, peopleRows] = await Promise.all([
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
    console.warn('[notifications] signal.notice: space not found', { spaceId });
    return [];
  }

  const url = getAbsoluteAppUrl(
    `${getSpaceDhoPath(space.slug, 'coherence')}?signal=${encodeURIComponent(
      event.payload.signalSlug,
    )}`,
  );
  const actorDisplayName =
    [actor?.name, actor?.surname].filter(Boolean).join(' ').trim() || undefined;
  const data = {
    spaceTitle: space.title,
    actorDisplayName,
    url,
    dueAt: event.payload.dueAt ?? null,
  };

  const recipients: Recipient[] = [];
  for (const { slug } of peopleRows) {
    if (!slug) continue;
    recipients.push({ personSlug: slug, role: event.context.kind, data });
  }
  return recipients;
};
