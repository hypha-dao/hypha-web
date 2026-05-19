'use server';

import { eq, inArray } from 'drizzle-orm';
import { matrixUserLinks, people, db } from '@hypha-platform/storage-postgres';
import { NotifyChatMentionInput } from '@hypha-platform/core/client';
import { sendEmailNotifications, sendPushNotifications } from '../mutations';
import { TAG_MENTION_CONSENT } from '../constants';
import {
  buildMentionEmailBody,
  sanitizeMentionIds,
} from './notify-chat-mention.utils';

export async function notifyChatMentionAction(
  {
    actorSlug,
    actorDisplayName,
    mentionMatrixUserIds,
    messagePreview,
    url,
  }: NotifyChatMentionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to send mention notifications');
  }
  const matrixIds = sanitizeMentionIds(mentionMatrixUserIds);
  if (matrixIds.length === 0) return;

  const recipients = await db
    .select({
      slug: people.slug,
      matrixUserId: matrixUserLinks.matrixUserId,
    })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .where(inArray(matrixUserLinks.matrixUserId, matrixIds));

  const usernames = [
    ...new Set(
      recipients
        .map((r) => r.slug?.trim())
        .filter((slug): slug is string => Boolean(slug && slug !== actorSlug)),
    ),
  ];
  if (usernames.length === 0) return;

  const safeActor = actorDisplayName?.trim() || 'Someone';
  const safePreview = messagePreview?.trim() || '';
  const subject = `${safeActor} mentioned you`;
  const contents = {
    en: safePreview || `${safeActor} mentioned you in chat.`,
  };
  const headings = {
    en: `${safeActor} mentioned you`,
  };

  const requiredTags = {
    [TAG_MENTION_CONSENT]: 'true',
  };

  await Promise.allSettled([
    sendPushNotifications({
      contents,
      headings,
      usernames,
      requiredTags,
      url,
    }),
    sendEmailNotifications({
      subject,
      body: buildMentionEmailBody({
        actorDisplayName: safeActor,
        messagePreview: safePreview,
        url,
      }),
      usernames,
      requiredTags,
    }),
  ]);
}
