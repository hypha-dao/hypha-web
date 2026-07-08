import type { Locale } from './routing';
import { routing } from './routing';
import enMessages from './messages/en.json';
import deMessages from './messages/de.json';
import esMessages from './messages/es.json';
import frMessages from './messages/fr.json';
import ptMessages from './messages/pt.json';
import mkMessages from './messages/mk.json';

type Messages = Record<string, unknown>;

const FALLBACK_LOCALE: Locale = routing.defaultLocale;
export const defaultMessages: Messages = enMessages as Messages;
const localeMessagesMap: Record<Locale, Messages> = {
  en: enMessages as Messages,
  de: deMessages as Messages,
  es: esMessages as Messages,
  fr: frMessages as Messages,
  pt: ptMessages as Messages,
  mk: mkMessages as Messages,
};

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

export function getLocaleMessagesSync(localeInput: string | null | undefined): {
  locale: Locale;
  messages: Messages;
} {
  const locale = resolveLocale(localeInput);
  return {
    locale,
    messages: deepMerge(defaultMessages, localeMessagesMap[locale] ?? {}),
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
