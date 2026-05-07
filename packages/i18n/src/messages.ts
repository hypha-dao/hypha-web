import type { Locale } from './routing';
import { routing } from './routing';

type Messages = Record<string, unknown>;

const FALLBACK_LOCALE: Locale = routing.defaultLocale;

export function resolveLocale(locale: string | null | undefined): Locale {
  if (!locale) {
    return FALLBACK_LOCALE;
  }
  return routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : FALLBACK_LOCALE;
}

export async function loadLocaleMessages(
  localeInput: string | null | undefined,
): Promise<{ locale: Locale; messages: Messages }> {
  const locale = resolveLocale(localeInput);
  const defaultMessages = (await import('./messages/en.json'))
    .default as Messages;
  let localeMessages: Messages = {};

  try {
    localeMessages = (await import(`./messages/${locale}.json`))
      .default as Messages;
  } catch (error) {
    console.warn(
      `[i18n] Missing messages for locale "${locale}", falling back to English.`,
      error,
    );
  }

  return {
    locale,
    messages: deepMerge(defaultMessages, localeMessages),
  };
}

function deepMerge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };

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

function isObject(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
