import type { LocaleInput } from '@fullcalendar/core';
import deLocale from '@fullcalendar/core/locales/de';
import enGbLocale from '@fullcalendar/core/locales/en-gb';
import esLocale from '@fullcalendar/core/locales/es';
import frLocale from '@fullcalendar/core/locales/fr';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

const FULLCALENDAR_LOCALES: Record<string, LocaleInput> = {
  de: deLocale,
  es: esLocale,
  fr: frLocale,
  pt: ptBrLocale,
  'pt-br': ptBrLocale,
  'en-gb': enGbLocale,
};

export function resolveFullCalendarLocale(locale: string): LocaleInput {
  const normalized = locale.toLowerCase().replaceAll('_', '-');
  const baseLocale = normalized.split('-')[0] ?? 'en';
  return (
    FULLCALENDAR_LOCALES[normalized] ??
    FULLCALENDAR_LOCALES[baseLocale] ??
    enGbLocale
  );
}
