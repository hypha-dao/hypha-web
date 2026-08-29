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
    // (e.g. an invalid template_id) — log it here, since callers further up only see the
    // generic message below and would otherwise have no way to tell what OneSignal objected to.
    const apiError = error as { code?: number; body?: unknown };
    console.error('[notifications] OneSignal createNotification failed', {
      code: apiError?.code,
      body: apiError?.body,
    });
    throw new Error('Failed to create a notification', { cause: error });
  }
}
