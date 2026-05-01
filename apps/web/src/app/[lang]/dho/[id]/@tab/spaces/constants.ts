import { Locale } from '@hypha-platform/i18n';

export const getDhoPathSpaces = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/spaces`;
};
