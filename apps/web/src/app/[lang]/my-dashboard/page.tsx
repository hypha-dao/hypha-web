import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

/** Earlier address for Home. */
export default async function MyDashboardPage(props: PageProps) {
  const { lang } = await props.params;
  redirect(`/${lang}/home`);
}
