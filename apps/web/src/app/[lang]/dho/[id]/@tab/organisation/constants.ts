import { Locale } from '@hypha-platform/i18n';

export const getDhoPathOrganisation = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/organisation`;
};
