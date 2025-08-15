'use server';

import type { Notification } from '@onesignal/node-onesignal';
import { sdkClient } from './client';
import crypto from 'crypto';

/**
 * @brief forms and send a notification
 * @return id of created notification
 *
 * @warn resets "idempotency_key" in the notification
 */
export async function sendNotification(
  notification: Notification,
): Promise<string> {
  const unique = crypto.randomUUID();
  notification.idempotency_key = unique;

  const response = await sdkClient.createNotification(notification);
  if (!response.id || response.external_id !== unique) {
    const reason = response.errors ? String(response.errors) : 'unknown error';

    throw new Error(`Failed to create an email notification: ${reason}`);
  }

  return response.id;
}
