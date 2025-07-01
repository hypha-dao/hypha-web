import { Locale } from '@hypha-platform/i18n';

export const getDhoPathGovernance = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/governance`;
};
