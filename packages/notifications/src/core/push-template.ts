import type { NotificationPushContent } from './types';

/**
 * The OneSignal dashboard push template when its (server-only) env var is set, else `undefined` so
 * the caller falls back to locally-rendered plain push. Mirrors `resolveEmailTemplate`:
 * `customData` values are sent raw, empty/undefined ones are dropped so a template's `| default:`
 * applies. `url` is sent both as the notification launch URL and — by the caller — in `customData`
 * (the existing dashboard templates read `{{ message.custom_data.url }}` as their Launch URL).
 */
export function resolvePushTemplate(
  envVar: string,
  customData: Record<string, string | undefined>,
  url?: string,
): NotificationPushContent | undefined {
  const templateId = process.env[envVar]?.trim();
  if (!templateId) return undefined;

  return {
    kind: 'template',
    templateId,
    customData: Object.fromEntries(
      Object.entries(customData).filter(
        (entry): entry is [string, string] => !!entry[1],
      ),
    ),
    url,
  };
}
