import { z } from 'zod';

export const SUPPORTED_UI_LOCALES = ['en', 'pt', 'es', 'fr', 'de'] as const;

const localeCodeSchema = z.enum(SUPPORTED_UI_LOCALES);

export type SupportedUiLocale = z.infer<typeof localeCodeSchema>;

const LANGUAGE_NAME_BY_LOCALE: Record<SupportedUiLocale, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

const SUPPORTED_LANGUAGE_LIST = Object.values(LANGUAGE_NAME_BY_LOCALE).join(
  ', ',
);

/** Normalize a route/UI locale to one of Hypha's five supported codes, or null. */
export function resolveSupportedUiLocale(
  locale?: string,
): SupportedUiLocale | null {
  const base = locale?.trim().toLowerCase().split('-')[0];
  if (!base) return null;
  const parsed = localeCodeSchema.safeParse(base);
  return parsed.success ? parsed.data : null;
}

/** Prompt directive so chat and voice replies stay within Hypha's five UI languages. */
export function buildOnboardingLocaleDirective(locale?: string): string | null {
  const code = resolveSupportedUiLocale(locale);
  if (!code) return null;

  const languageName = LANGUAGE_NAME_BY_LOCALE[code];

  return `- Default UI locale: ${languageName} (${code}). Hypha supports ONLY these five languages: ${SUPPORTED_LANGUAGE_LIST}. The user may speak or switch among any of them—match their language and reply in whichever of these five they are using. Never use any language outside this set. Use natural spoken language for voice turns.`;
}
