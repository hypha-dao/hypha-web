import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { cookies } from 'next/headers';
import { routing } from './routing';

const TIME_ZONE_COOKIE = 'hypha-timezone';
const FALLBACK_TIME_ZONE = 'UTC';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const cookieStore = await cookies();
  const timeZone = sanitizeTimeZone(
    cookieStore.get(TIME_ZONE_COOKIE)?.value ?? FALLBACK_TIME_ZONE,
  );

  const defaultMessages = (await import('./messages/en.json')).default;
  let localeMessages: Record<string, unknown> = {};

  try {
    localeMessages = (await import(`./messages/${locale}.json`)).default;
  } catch (error) {
    console.warn(
      `[i18n] Missing messages for locale "${locale}", falling back to English.`,
      error,
    );
  }

  return {
    locale,
    messages: deepMerge(defaultMessages, localeMessages),
    timeZone,
  };
});

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];

    if (isObject(baseValue) && isObject(value)) {
      result[key] = deepMerge(baseValue, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeTimeZone(value: string): string {
  if (!value) return FALLBACK_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}
