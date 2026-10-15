'use server';

import { NotifyCallStartedInput } from '@hypha-platform/core/client';
import { PrivyClient } from '@privy-io/node';
import { dispatch } from '../core/dispatch';
import { buildCallStartedEvent } from '../events/call-started';

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

  // Recipient scoping, consent gating (`consent_meetings`) and the shared email layout all live
  // behind `dispatch()` now (#2549 D16).
  const result = await dispatch(
    buildCallStartedEvent({
      actorSlug: actorSlug?.trim(),
      actorDisplayName,
      spaceSlug: trimmedSpaceSlug,
      contextLabel,
      scope,
      targetMatrixUserIds,
      url,
    }),
  );

  // `null` = nothing to send after scoping/consent — not a failure. Only a delivery attempt
  // where nothing got through is reported as one.
  if (result && result.sent === 0 && result.failed > 0) {
    console.error(
      '[notifyCallStartedAction] Notification delivery failed',
      result,
    );
    throw new Error('Failed to deliver call notification on all channels');
  }
}
