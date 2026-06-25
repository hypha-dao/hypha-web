import { Locale } from '@hypha-platform/i18n';

export const getDhoPathCalendar = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/calendar`;
};
