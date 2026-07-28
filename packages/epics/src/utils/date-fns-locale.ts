/**
 * Single source of truth for mapping app locale codes (next-intl / URL prefix)
 * to `date-fns` locale objects. Do not duplicate `DATE_FNS_LOCALES` or a local
 * `resolveDateFnsLocale` in feature code — import `resolveDateFnsLocale` from
 * this module instead (e.g. treasury token-backing-vault, coherence signal-card).
 */
import {
  de,
  enUS,
  es,
  fr,
  mk,
  nb,
  nl,
  ptBR,
  type Locale as DateFnsLocale,
} from 'date-fns/locale';

const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  en: enUS,
  de,
  fr,
  es,
  mk,
  nl,
  no: nb,
  pt: ptBR,
  'pt-br': ptBR,
};

export const resolveDateFnsLocale = (locale: string): DateFnsLocale => {
  const normalized = locale.toLowerCase().replaceAll('_', '-');
  const baseLocale = normalized.split('-')[0] ?? 'en';

  return DATE_FNS_LOCALES[normalized] ?? DATE_FNS_LOCALES[baseLocale] ?? enUS;
};
