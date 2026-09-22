import { and, eq, inArray } from 'drizzle-orm';
import {
  coherences,
  db,
  matrixUserLinks,
  memberships,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';
import {
  findSpaceMemberSlugsBySpaceId,
  normalizeAssigneeIds,
} from '@hypha-platform/core/server';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { ChatNotificationEvent, Recipient } from '../../core/types';
import { buildChatDeepLink } from './deep-link';

async function findPersonByMatrixUserId(
  matrixUserId: string,
): Promise<{
  slug: string | null;
  name: string | null;
  surname: string | null;
} | null> {
  const [row] = await db
    .select({ slug: people.slug, name: people.name, surname: people.surname })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .where(eq(matrixUserLinks.matrixUserId, matrixUserId))
    .limit(1);
  return row ?? null;
}

/** Only the specifically mentioned users, scoped to members of the room's own space (never trust the room mapping from the payload — resolved from our DB via `event.context`). */
async function resolveMentionRecipientSlugs(
  event: ChatNotificationEvent,
): Promise<string[]> {
  const mentionIds = [
    ...new Set(
      event.payload.mentionedMatrixUserIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (mentionIds.length === 0) return [];

  const rows = await db
    .select({ slug: people.slug })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .where(
      and(
        inArray(matrixUserLinks.matrixUserId, mentionIds),
        eq(memberships.spaceId, event.context.spaceId),
      ),
    );
  return rows.map((r) => r.slug?.trim()).filter((s): s is string => Boolean(s));
}

/** Every space member for a space-room message; only the signal's assignees for a signal-room message (never the whole space — a signal thread is scoped, not broadcast). */
async function resolveAllMessagesRecipientSlugs(
  event: ChatNotificationEvent,
): Promise<string[]> {
  const { context } = event;
  if (context.kind === 'space') {
    return findSpaceMemberSlugsBySpaceId({ spaceId: context.spaceId }, { db });
  }

  const [coherence] = await db
    .select({ assigneeIds: coherences.assigneeIds })
    .from(coherences)
    .where(eq(coherences.id, context.coherenceId))
    .limit(1);
  const assigneeIds = normalizeAssigneeIds(coherence?.assigneeIds);
  if (assigneeIds.length === 0) return [];

  const rows = await db
    .select({ slug: people.slug })
    .from(people)
    .where(inArray(people.id, assigneeIds));
  return rows.map((r) => r.slug?.trim()).filter((s): s is string => Boolean(s));
}

async function resolveSignalSlug(coherenceId: number): Promise<string | null> {
  const [row] = await db
    .select({ slug: coherences.slug })
    .from(coherences)
    .where(eq(coherences.id, coherenceId))
    .limit(1);
  return row?.slug?.trim() || null;
}

export const resolveChatRecipients: RecipientResolver<
  ChatNotificationEvent
> = async (event) => {
  const { context, actor } = event;

  const [spaceRow, actorPerson, signalSlug] = await Promise.all([
    db
      .select({ title: spaces.title })
      .from(spaces)
      .where(eq(spaces.id, context.spaceId))
      .limit(1),
    findPersonByMatrixUserId(actor.externalUserId),
    context.kind === 'signal'
      ? resolveSignalSlug(context.coherenceId)
      : Promise.resolve(null),
  ]);
  const spaceTitle = spaceRow[0]?.title ?? undefined;

  const candidateSlugs =
    event.type === 'chat.mention'
      ? await resolveMentionRecipientSlugs(event)
      : await resolveAllMessagesRecipientSlugs(event);
  if (candidateSlugs.length === 0) return [];

  const actorSlug = actorPerson?.slug?.trim();
  const recipientSlugs = [...new Set(candidateSlugs)].filter(
    (slug) => slug && slug !== actorSlug,
  );
  if (recipientSlugs.length === 0) return [];

  const actorDisplayName =
    [actorPerson?.name, actorPerson?.surname]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Someone';
  const messagePreview = event.payload.body.trim().slice(0, 220);
  const url = buildChatDeepLink({
    spaceSlug: context.spaceSlug,
    messageId: event.source.externalEventId,
    signalSlug,
  });

  const data = { actorDisplayName, messagePreview, url, spaceTitle };
  return recipientSlugs.map(
    (personSlug): Recipient => ({ personSlug, role: event.type, data }),
  );
};
