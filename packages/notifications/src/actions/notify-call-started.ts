'use server';

import { NotifyCallStartedInput } from '@hypha-platform/core/client';
import { PrivyClient } from '@privy-io/node';
import { TAG_MENTION_CONSENT } from '../constants';
import { sendEmailNotifications, sendPushNotifications } from '../mutations';
import { buildCallStartedEmailBody } from './notify-call-started.utils';
import { resolveCallStartedRecipientSlugs } from './notify-call-started.recipients';

let privyClientSingleton: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'Missing Privy configuration for auth token validation in call notifications',
    );
  }
  if (!privyClientSingleton) {
    privyClientSingleton = new PrivyClient({ appId, appSecret });
  }
  return privyClientSingleton;
}

async function assertValidAuthToken(authToken: string): Promise<void> {
  try {
    await getPrivyClient().utils().auth().verifyAuthToken(authToken);
  } catch (error) {
    console.error(
      '[notifyCallStartedAction] Invalid auth token while sending call notifications',
      error,
    );
    throw new Error('Invalid auth token for call notifications');
  }
}

export async function notifyCallStartedAction(
  {
    actorSlug,
    actorDisplayName,
    spaceSlug,
    contextLabel,
    scope,
    targetMatrixUserIds,
    url,
  }: NotifyCallStartedInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to send call notifications');
  }
  await assertValidAuthToken(authToken);

  const trimmedSpaceSlug = spaceSlug?.trim();
  if (!trimmedSpaceSlug) return;

  const usernames = await resolveCallStartedRecipientSlugs({
    scope,
    spaceSlug: trimmedSpaceSlug,
    actorSlug: actorSlug?.trim(),
    targetMatrixUserIds,
  });
  if (usernames.length === 0) return;

  const safeActor = actorDisplayName?.trim() || 'Someone';
  const safeContext = contextLabel?.trim() || 'chat';
  const subject = `${safeActor} started a call`;
  const contents = {
    en: `Join the call in ${safeContext}.`,
  };
  const headings = {
    en: subject,
  };
  const requiredTags = {
    [TAG_MENTION_CONSENT]: 'true',
  };

  const results = await Promise.allSettled([
    sendPushNotifications({
      contents,
      headings,
      usernames,
      requiredTags,
      url,
    }),
    sendEmailNotifications({
      subject,
      body: buildCallStartedEmailBody({
        actorDisplayName: safeActor,
        contextLabel: safeContext,
        url,
      }),
      usernames,
      requiredTags,
    }),
  ]);

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (rejected.length > 0) {
    console.error(
      '[notifyCallStartedAction] Notification delivery failed',
      rejected.map((r) => r.reason),
    );
    if (rejected.length === results.length) {
      throw new Error('Failed to deliver call notification on all channels');
    }
  }
}
