'use client';

const SUPPORTED_APP_LOCALES = [
  'en',
  'pt',
  'es',
  'fr',
  'de',
  'mk',
  'nl',
  'no',
] as const;

type AppLocale = (typeof SUPPORTED_APP_LOCALES)[number];

/** BCP-47 tags for browser SpeechRecognition + SpeechSynthesis. */
const SPEECH_LOCALE_BY_APP_LOCALE: Record<AppLocale, string> = {
  en: 'en-US',
  pt: 'pt-BR',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  mk: 'mk-MK',
  nl: 'nl-NL',
  no: 'nb-NO',
};

function isSupportedAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_APP_LOCALES as readonly string[]).includes(value);
}

/** Map Hypha route locale (en, pt, …) to a Web Speech–friendly BCP-47 tag. */
export function resolveOnboardingSpeechLocale(locale?: string): string {
  const normalized = locale?.trim().toLowerCase().split('-')[0] ?? '';
  if (normalized && isSupportedAppLocale(normalized)) {
    return SPEECH_LOCALE_BY_APP_LOCALE[normalized];
  }

  if (typeof document !== 'undefined') {
    const documentLang = document.documentElement.lang?.trim();
    if (documentLang) {
      const documentBase = documentLang.toLowerCase().split('-')[0] ?? '';
      if (documentBase && isSupportedAppLocale(documentBase)) {
        return SPEECH_LOCALE_BY_APP_LOCALE[documentBase];
      }
    }
  }

  return SPEECH_LOCALE_BY_APP_LOCALE.en;
}
