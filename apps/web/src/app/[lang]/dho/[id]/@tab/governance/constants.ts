import { Locale } from '@hypha-platform/i18n';

export const getDhoPathGovernance = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/governance`;
};

export const selectCreateActionPath = "/select-create-action";
export const selectSettingsActionPath = "/select-settings-action";