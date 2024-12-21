import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;

  const { lang } = params;

  return <div>NetworkPage</div>;
}
