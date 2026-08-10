'use server';

import { eq, inArray } from 'drizzle-orm';
import { people, db } from '@hypha-platform/storage-postgres';
import { NotifySignalAssignedInput } from '@hypha-platform/core/client';
import { PrivyClient } from '@privy-io/node';
import { sendEmailNotifications } from '../mutations';
import {
  buildSignalAssignedEmailBody,
  buildSignalAssignedEmailSubject,
} from './notify-signal-assigned.utils';

let privyClientSingleton: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'Missing Privy configuration for auth token validation in signal assignment notifications',
    );
  }
  if (!privyClientSingleton) {
    privyClientSingleton = new PrivyClient({ appId, appSecret });
  }
  return privyClientSingleton;
}

/** Resolves the caller so we never email someone about assigning themselves. */
async function resolveActorPersonId(authToken: string): Promise<number | null> {
  let privyUserId: string;
  try {
    const { user_id } = await getPrivyClient()
      .utils()
      .auth()
      .verifyAuthToken(authToken);
    privyUserId = user_id;
  } catch (error) {
    console.error(
      '[notifySignalAssignedAction] Invalid auth token while sending assignment notifications',
      error,
    );
    throw new Error('Invalid auth token for signal assignment notifications');
  }

  const [actor] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.sub, privyUserId))
    .limit(1);

  return actor?.id ?? null;
}

export async function notifySignalAssignedAction(
  {
    assigneePersonIds,
    signalTitle,
    spaceTitle,
    actorDisplayName,
    url,
  }: NotifySignalAssignedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to send assignment notifications');
  }
  const personIds = [
    ...new Set(
      assigneePersonIds.filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (personIds.length === 0) return;

  const actorPersonId = await resolveActorPersonId(authToken);
  const recipientIds = personIds.filter((id) => id !== actorPersonId);
  if (recipientIds.length === 0) return;

  const recipients = await db
    .select({ slug: people.slug })
    .from(people)
    .where(inArray(people.id, recipientIds));

  const usernames = [
    ...new Set(
      recipients
        .map((recipient) => recipient.slug?.trim())
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];
  if (usernames.length === 0) return;

  const title = signalTitle.trim() || 'a signal';

  await sendEmailNotifications({
    usernames,
    subject: buildSignalAssignedEmailSubject(title),
    body: buildSignalAssignedEmailBody({
      signalTitle: title,
      spaceTitle,
      actorDisplayName,
      url,
    }),
  });
}
