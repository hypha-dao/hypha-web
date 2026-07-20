import type { Locale } from './routing';

export type LocaleMetadata = {
  code: Locale;
  label: string;
  shortLabel: string;
};

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  pt: { code: 'pt', label: 'Português', shortLabel: 'PT' },
  es: { code: 'es', label: 'Español', shortLabel: 'ES' },
  fr: { code: 'fr', label: 'Français', shortLabel: 'FR' },
  de: { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
  mk: { code: 'mk', label: 'Македонски', shortLabel: 'MK' },
  nl: { code: 'nl', label: 'Nederlands', shortLabel: 'NL' },
};
