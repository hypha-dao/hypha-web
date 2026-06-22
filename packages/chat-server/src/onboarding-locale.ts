import { z } from 'zod';

const localeCodeSchema = z.enum(['en', 'pt', 'es', 'fr', 'de']);

const LANGUAGE_NAME_BY_LOCALE: Record<
  z.infer<typeof localeCodeSchema>,
  string
> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

function normalizeLocaleCode(locale?: string): string | undefined {
  const base = locale?.trim().toLowerCase().split('-')[0];
  if (!base) return undefined;
  const parsed = localeCodeSchema.safeParse(base);
  return parsed.success ? parsed.data : base;
}

/** Prompt directive so onboarding chat/voice replies match the UI locale. */
export function buildOnboardingLocaleDirective(locale?: string): string | null {
  const code = normalizeLocaleCode(locale);
  if (!code) return null;

  const languageName =
    code in LANGUAGE_NAME_BY_LOCALE
      ? LANGUAGE_NAME_BY_LOCALE[code as z.infer<typeof localeCodeSchema>]
      : code;

  return `- Respond in ${languageName} (locale: ${code}). Use natural spoken language for voice turns; keep chat replies in the same language unless the user switches.`;
}
