import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function LegacyDashboardPage(props: PageProps) {
  const { lang } = await props.params;
  redirect(`/${lang}/home`);
}
