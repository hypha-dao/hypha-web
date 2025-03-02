import { getDictionary, Locale } from '@hypha-platform/i18n';
import { Debug } from './_components/debug';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang, id: daoSlug } = params;

  const t = await getDictionary(lang);
  return (
    <div>
      {t('DHO Dashboard')}
      <Debug />
    </div>
  );
}
