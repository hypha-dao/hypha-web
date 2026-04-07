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
