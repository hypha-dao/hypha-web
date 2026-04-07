import { Locale } from '@hypha-platform/i18n';

export const getDhoPathMembers = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/members`;
};
