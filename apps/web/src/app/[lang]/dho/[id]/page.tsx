import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';
import { getDhoPathOverview } from './@tab/overview/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const { lang, id } = await props.params;
  redirect(getDhoPathOverview(lang, id));
}
