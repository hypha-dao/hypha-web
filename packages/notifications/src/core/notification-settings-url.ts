import { getAbsoluteAppUrl } from '@hypha-platform/core/server';

/**
 * Where the "Manage notification settings" footer link of every notification email points — the
 * Notification Centre (global per-user preferences, not per space). Resolved server-side so
 * previews link to their own host (`NEXT_PUBLIC_APP_URL`); defaults to `en` like the other
 * server-built links, since a server event has no active UI locale to read.
 *
 * Email templates read it as `message.custom_data.notification_settings_url` and should keep a
 * `| default:` fallback to the production URL.
 */
export function buildNotificationSettingsUrl(): string {
  return getAbsoluteAppUrl('/en/network/notification-centre');
}
