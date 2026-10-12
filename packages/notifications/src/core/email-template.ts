import type { NotificationEmailContent } from './types';

/**
 * The OneSignal dashboard template for an email when its (server-only) env var is set, else
 * `undefined` so the caller falls back to locally-rendered plain content — an environment without
 * the template ID configured still sends the email. `customData` values are sent raw (the
 * template escapes them); empty/undefined values are dropped so a template's `| default:` applies.
 */
export function resolveEmailTemplate(
  envVar: string,
  customData: Record<string, string | undefined>,
): NotificationEmailContent | undefined {
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
  };
}
