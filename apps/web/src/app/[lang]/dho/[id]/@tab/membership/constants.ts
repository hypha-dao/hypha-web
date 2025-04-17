import { Locale } from '@hypha-platform/i18n';

export const getDhoPathMembership = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/membership`;
};
