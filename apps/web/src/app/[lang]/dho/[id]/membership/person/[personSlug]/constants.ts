import { createPathHelper } from '@web/utils/create-path-helper';

type PersonPathParams = {
  lang: string;
  id: string;
  personSlug: string;
};

export const getPath = createPathHelper<PersonPathParams>(__dirname);
