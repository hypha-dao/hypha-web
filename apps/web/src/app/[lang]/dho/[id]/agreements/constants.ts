import { Locale } from '@hypha-platform/i18n';
import { ROOT_PATH } from '@web/app/constants';
import { createPathHelper } from '@web/utils/create-path-helper';

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  console.debug('getDhoPathAgreements', { path: __dirname.split(ROOT_PATH) });
  return `/${lang}/dho/${id}/agreements`;
};

type AgreementsPathParams = {
  lang: string;
  id: string;
};

export const getPath = createPathHelper<AgreementsPathParams>(__dirname);
