import { getAccessToken, getDaoDetail } from '@hypha-platform/graphql/rsc';
import { getDictionary, Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang, id: daoSlug } = params;

  const newtoken = await getAccessToken();
  const t = await getDictionary(lang);
  const dao = await getDaoDetail({ token: newtoken.accessJWT, daoSlug });
  return (
    <div>
      {t('DHO Dashboard')}
      <pre>{JSON.stringify(dao, null, 2)}</pre>
    </div>
  );
}
