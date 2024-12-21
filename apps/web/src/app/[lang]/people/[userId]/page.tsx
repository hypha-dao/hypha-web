import { getDictionary, Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

  const t = await getDictionary(lang);
  return <div>{t('DHO Dashboard')}</div>;
}
