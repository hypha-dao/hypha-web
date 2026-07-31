import { Locale } from '@hypha-platform/i18n';
import { LandingPage } from './_components/landing-page';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;
  const { lang } = params;

  return <LandingPage lang={lang} />;
}
