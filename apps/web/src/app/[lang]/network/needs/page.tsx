import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

export default async function NeedsPage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  redirect(`/${lang}/network/exchange?type=Need`);
}
