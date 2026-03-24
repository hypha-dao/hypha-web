import type { Locale } from './routing';

export type LocaleMetadata = {
  code: Locale;
  label: string;
  shortLabel: string;
};

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  de: { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
  fr: { code: 'fr', label: 'Français', shortLabel: 'FR' },
};
