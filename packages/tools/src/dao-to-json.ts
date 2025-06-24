import { getDaoList, getAccessToken } from '@hypha-platform/graphql/rsc';
import { writeJson } from './utils/file-writer';

type Dao = {
  slug: string;
  title: string;
  description: string;
  logo_url: string;
  created_at: string;
};

const mapToDaoType = (dao: {
  url: string | null | undefined;
  title: string | null | undefined;
  description: string | null | undefined;
  logo: string | null | undefined;
  date: string | null | undefined;
}): Dao => {
  return {
    slug: dao.url ?? 'MISSING_AT_IMPORT',
    title: dao.title ?? 'MISSING_AT_IMPORT',
    description: dao.description ?? 'MISSING_AT_IMPORT',
    logo_url: dao.logo ?? 'MISSING_AT_IMPORT',
    created_at: dao.date ?? 'MISSING_AT_IMPORT',
  };
};

export const daosToJson = async (outputPath: string) => {
  const token = await getAccessToken();
  const daos = await getDaoList({
    token: token.accessJWT,
  });

  await writeJson(outputPath, daos.map(mapToDaoType));
  return daos;
};
