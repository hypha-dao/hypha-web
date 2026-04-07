/**
 * Maps app locale codes (next-intl / URL prefix) to `date-fns` locale objects.
 * Keep this module feature-agnostic — treasury, coherence, and other epics import
 * from here instead of coupling through another feature folder.
 */
import {
  de,
  enUS,
  es,
  fr,
  ptBR,
  type Locale as DateFnsLocale,
} from 'date-fns/locale';

const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  en: enUS,
  de,
  fr,
  es,
  pt: ptBR,
  'pt-br': ptBR,
};

export const resolveDateFnsLocale = (locale: string): DateFnsLocale => {
  const normalized = locale.toLowerCase().replaceAll('_', '-');
  const baseLocale = normalized.split('-')[0] ?? 'en';

  return DATE_FNS_LOCALES[normalized] ?? DATE_FNS_LOCALES[baseLocale] ?? enUS;
};
