import { Locale } from '@hypha-platform/i18n';
import { PATH_LANG } from '../../constants';
import { Paths } from '@hypha-platform/tools';

export const PATH_SEGMENT_DHO_ID = ':id';

export const PATH_DHO = `${PATH_LANG}/dho/${PATH_SEGMENT_DHO_ID}`;

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  return Paths.dho.agreements(lang, id);
};
