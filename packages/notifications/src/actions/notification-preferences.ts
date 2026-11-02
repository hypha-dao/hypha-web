'use server';

import { resolvePersonFromAuthToken } from '@hypha-platform/core/server';
import {
  enrolNotifications,
  getNotificationPreferences,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  saveNotificationPreferences,
  unenrolNotifications,
} from '../core/preferences';

type AuthArgs = { authToken?: string };

/** The signed-in person from the verified token. The slug is never taken from the client. */
async function requirePerson(authToken: string | undefined) {
  const person = await resolvePersonFromAuthToken(authToken);
  if (!person?.slug) {
    throw new Error('Not authorized to manage notification settings');
  }
  return { slug: person.slug, email: person.email };
}

export async function getNotificationPreferencesAction({
  authToken,
}: AuthArgs): Promise<NotificationPreferences> {
  const { slug } = await requirePerson(authToken);
  return getNotificationPreferences(slug);
}

export async function enrolNotificationsAction({
  authToken,
}: AuthArgs): Promise<NotificationPreferences> {
  const { slug } = await requirePerson(authToken);
  return enrolNotifications(slug);
}

export async function unenrolNotificationsAction({
  authToken,
}: AuthArgs): Promise<NotificationPreferences> {
  const { slug } = await requirePerson(authToken);
  return unenrolNotifications(slug);
}

export async function saveNotificationPreferencesAction(
  update: NotificationPreferencesUpdate,
  { authToken }: AuthArgs,
): Promise<NotificationPreferences> {
  const { slug, email } = await requirePerson(authToken);
  return saveNotificationPreferences(slug, email, update);
}
