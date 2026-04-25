import { Locale } from '@hypha-platform/i18n';

export const getDhoPathArtifact = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/artifact`;
};
