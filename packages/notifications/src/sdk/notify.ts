'use server';

import type { Notification } from '@onesignal/node-onesignal';
import { sdkClient } from './client';
import { randomUUID } from 'crypto';

export async function notify(notification: Notification): Promise<string> {
  if (!notification.app_id)
    throw new Error('App ID is not set in notification');

  const unique = randomUUID();
  notification.idempotency_key = unique;

  try {
    const response = await sdkClient.createNotification(notification);
    if (!response.id || response.external_id !== unique) {
      const reason = response?.errors ?? 'unknown error';

      throw new Error('Failed to notify', { cause: reason });
    }

    return response.id;
  } catch (error) {
    // OneSignal's SDK throws an ApiException carrying the actual rejection reason in `body`
    // (e.g. an invalid template_id); for a 200 that carries no notification id (e.g. every recipient
    // is an `invalid_aliases`) the reason travels in `cause` instead. Log both, plus which channel
    // and how many recipients — callers further up only see the generic message below, and this line
    // is often all that is left to diagnose a prod delivery failure from.
    const apiError = error as {
      code?: number;
      body?: unknown;
      cause?: unknown;
    };
    console.error('[notifications] OneSignal createNotification failed', {
      channel: notification.target_channel,
      recipients: notification.include_aliases?.external_id?.length,
      code: apiError?.code,
      body: stringifyForLog(apiError?.body),
      reason: stringifyForLog(apiError?.cause),
    });
    throw new Error('Failed to create a notification', { cause: error });
  }
}

/** Nested error objects print as `[Object]` in server logs — serialise them so the detail survives. */
function stringifyForLog(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
