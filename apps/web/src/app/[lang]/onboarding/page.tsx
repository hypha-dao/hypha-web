import { Locale } from '@hypha-platform/i18n';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

/** Old address. The create-a-space screen lives at /interactive-create. */
export default async function OnboardingRedirect({ params }: PageProps) {
  const { lang } = await params;
  redirect(`/${lang}/interactive-create`);
}
