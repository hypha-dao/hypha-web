import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function NetworkCreateSpacePage({ params }: PageProps) {
  const { lang } = await params;
  redirect(`/${lang}/onboarding`);
}
