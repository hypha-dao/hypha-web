'use server';

import { and, eq, inArray, ne } from 'drizzle-orm';
import {
  matrixUserLinks,
  memberships,
  people,
  db,
} from '@hypha-platform/storage-postgres';
import { NotifyChatMentionInput } from '@hypha-platform/core/client';
import { PrivyClient } from '@privy-io/node';
import {
  sendEmailNotificationsToEmails,
  sendPushNotifications,
} from '../mutations';
import { TAG_MENTION_CONSENT } from '../constants';
import {
  buildMentionEmailBody,
  sanitizeMentionIds,
} from './notify-chat-mention.utils';

let privyClientSingleton: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'Missing Privy configuration for auth token validation in mention notifications',
    );
  }
  if (!privyClientSingleton) {
    privyClientSingleton = new PrivyClient({ appId, appSecret });
  }
  return privyClientSingleton;
}

async function resolveAuthenticatedActor(
  authToken: string,
): Promise<{ id: number; slug: string }> {
  let privyUserId: string;
  try {
    const { user_id } = await getPrivyClient()
      .utils()
      .auth()
      .verifyAuthToken(authToken);
    privyUserId = user_id;
  } catch (error) {
    console.error(
      '[notifyChatMentionAction] Invalid auth token while sending mention notifications',
      error,
    );
    throw new Error('Invalid auth token for mention notifications');
  }

  const [actor] = await db
    .select({ id: people.id, slug: people.slug })
    .from(people)
    .where(eq(people.sub, privyUserId))
    .limit(1);

  const slug = actor?.slug?.trim();
  if (!actor?.id || !slug) {
    throw new Error('Authenticated user is not linked to a Hypha profile');
  }

  return { id: actor.id, slug };
}

export async function notifyChatMentionAction(
  {
    actorSlug,
    actorDisplayName,
    mentionMatrixUserIds,
    messagePreview,
    contextLabel,
    url,
  }: NotifyChatMentionInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to send mention notifications');
  }
  const actor = await resolveAuthenticatedActor(authToken);

  // Never trust client-provided actorSlug for exclusion/identity — only allow it
  // when it matches the authenticated profile (or is omitted).
  const claimedSlug = actorSlug?.trim();
  if (claimedSlug && claimedSlug !== actor.slug) {
    throw new Error('actorSlug does not match the authenticated user');
  }

  const matrixIds = sanitizeMentionIds(mentionMatrixUserIds);
  if (matrixIds.length === 0) return;

  // Recipients must share at least one space membership with the actor so a
  // valid token cannot fan out mention emails to arbitrary linked users.
  const actorSpaceIds = db
    .select({ spaceId: memberships.spaceId })
    .from(memberships)
    .where(eq(memberships.personId, actor.id));

  const recipients = await db
    .select({
      slug: people.slug,
      email: people.email,
      matrixUserId: matrixUserLinks.matrixUserId,
    })
    .from(matrixUserLinks)
    .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .where(
      and(
        inArray(matrixUserLinks.matrixUserId, matrixIds),
        inArray(memberships.spaceId, actorSpaceIds),
        ne(people.id, actor.id),
      ),
    );

  const uniqueRecipients = new Map<
    string,
    { slug: string; email: string | null }
  >();
  for (const recipient of recipients) {
    const slug = recipient.slug?.trim();
    if (!slug || slug === actor.slug) continue;
    if (!uniqueRecipients.has(slug)) {
      uniqueRecipients.set(slug, {
        slug,
        email: recipient.email?.trim() || null,
      });
    }
  }

  const usernames = [...uniqueRecipients.keys()];
  if (usernames.length === 0) return;

  const emails = [
    ...new Set(
      [...uniqueRecipients.values()]
        .map((r) => r.email)
        .filter((email): email is string => Boolean(email)),
    ),
  ];

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

  const emailBody = buildMentionEmailBody({
    actorDisplayName: safeActor,
    messagePreview: safePreview,
    url,
    contextLabel,
  });

  if (emails.length === 0) {
    console.warn(
      '[notifyChatMentionAction] No recipient emails on file for mentioned users',
      { recipientCount: usernames.length },
    );
  }

  // Email uses direct addresses so delivery works without OneSignal
  // subscription/tags (Discord-like mention alerts). Push stays opt-in via tags.
  // Recipients are already constrained to shared-space members above.
  const deliveries: Array<Promise<unknown>> = [
    sendPushNotifications({
      contents,
      headings,
      usernames,
      requiredTags,
      url,
    }),
  ];
  if (emails.length > 0) {
    deliveries.unshift(
      sendEmailNotificationsToEmails({
        subject,
        body: emailBody,
        emails,
      }),
    );
  }

  const results = await Promise.allSettled(deliveries);

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (rejected.length > 0) {
    console.error(
      '[notifyChatMentionAction] Notification delivery failed',
      rejected.map((r) => r.reason),
    );
    if (rejected.length === results.length) {
      throw new Error('Failed to deliver mention notification on all channels');
    }
  }
}
