import { eq, inArray } from 'drizzle-orm';
import {
  coherences,
  db,
  matrixUserLinks,
  people,
  spaces,
} from '@hypha-platform/storage-postgres';
import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixGetJoinedRoomMembers,
  normalizeAssigneeIds,
} from '@hypha-platform/core/server';
import type { RecipientResolver } from '../../core/recipient-resolver';
import type { ChatNotificationEvent, Recipient } from '../../core/types';
import { buildChatDeepLink } from './deep-link';
import { isChatMessageNotificationsDisabled } from './kill-switch';
import {
  applyMentionLabels,
  extractMentionUserIdsFromPlainBody,
  formatMentionLabel,
} from './mention-labels';

/** Replaces `@user:homeserver` tokens in a message body with the mentioned people's names. */
async function humanizeMessageBody(body: string): Promise<string> {
  const matrixUserIds = extractMentionUserIdsFromPlainBody(body);
  if (matrixUserIds.length === 0) return body;

  const rows = await db
    .select({
      matrixUserId: matrixUserLinks.matrixUserId,
      name: people.name,
      surname: people.surname,
    })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .where(inArray(matrixUserLinks.matrixUserId, matrixUserIds));

  const labels = new Map<string, string>();
  for (const row of rows) {
    const label = formatMentionLabel(row.name, row.surname);
    if (label) labels.set(row.matrixUserId, label);
  }
  return applyMentionLabels(body, labels);
}

async function findPersonByMatrixUserId(matrixUserId: string): Promise<{
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

/**
 * Who's actually in this Matrix room right now — the source of truth for chat recipients (#2470
 * D21). The Hypha `memberships` DB table this used to resolve against is effectively dead (2 rows
 * total in prod, none since 2025-03-03, nothing in this repo writes to it) — Matrix's own
 * membership state is live and authoritative for a room-sourced event like this one.
 */
async function fetchJoinedRoomMatrixUserIds(roomId: string): Promise<string[]> {
  const asToken = getMatrixBotAsToken();
  const homeserver = getMatrixHomeserverUrl();
  if (!asToken || !homeserver) {
    console.error(
      '[notifications] chat: Matrix bot AS token or homeserver URL not configured — cannot resolve room members',
    );
    return [];
  }
  try {
    return await matrixGetJoinedRoomMembers(roomId, asToken, homeserver);
  } catch (error) {
    console.error('[notifications] chat: failed to fetch joined room members', {
      roomId,
      error,
    });
    return [];
  }
}

async function resolveSlugsForMatrixUserIds(
  matrixUserIds: string[],
): Promise<string[]> {
  if (matrixUserIds.length === 0) return [];
  const rows = await db
    .select({ slug: people.slug })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .where(inArray(matrixUserLinks.matrixUserId, matrixUserIds));
  return rows.map((r) => r.slug?.trim()).filter((s): s is string => Boolean(s));
}

/** Only the specifically mentioned users, scoped to who's actually joined to the room (never trust the mention list alone — any room member could type an arbitrary mxid in a message). */
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

  const joined = new Set(await fetchJoinedRoomMatrixUserIds(event.roomId));
  const legitimateMentionIds = mentionIds.filter((id) => joined.has(id));
  return resolveSlugsForMatrixUserIds(legitimateMentionIds);
}

/** Every room member for a space-room message; only the signal's assignees for a signal-room message (never the whole space — a signal thread is scoped, not broadcast). */
async function resolveAllMessagesRecipientSlugs(
  event: ChatNotificationEvent,
): Promise<string[]> {
  const { context } = event;
  if (context.kind === 'space') {
    const joined = await fetchJoinedRoomMatrixUserIds(event.roomId);
    return resolveSlugsForMatrixUserIds(joined);
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

  // Checked before any Matrix/DB lookups so a disabled flag costs nothing per message.
  if (event.type === 'chat.message' && isChatMessageNotificationsDisabled()) {
    return [];
  }

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
  const messagePreview = (await humanizeMessageBody(event.payload.body))
    .trim()
    .slice(0, 220);
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
