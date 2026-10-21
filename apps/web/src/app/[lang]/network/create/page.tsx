import { redirect } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';

export default async function NetworkCreatePage(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;
  redirect(`/${lang}/network`);
}
