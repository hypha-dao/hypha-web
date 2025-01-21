import { Locale } from '@hypha-platform/i18n';
import { PATH_DHO, PATH_SEGMENT_DHO_ID } from '../constants';
import { PATH_SEGMENT_LANG } from '../../../constants';

export const PATH_ASSIGNMENTS = `${PATH_DHO}/assignments`;

export const getAssignmentsPath = (lang: Locale, id: string) => {
  return PATH_ASSIGNMENTS.replace(PATH_SEGMENT_LANG, lang).replace(
    PATH_SEGMENT_DHO_ID,
    id
  );
};
