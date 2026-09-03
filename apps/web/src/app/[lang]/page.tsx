import { redirect } from 'next/navigation';

import { Locale } from '@hypha-platform/i18n';
import { LandingPage } from './_components/landing-page';
import { resolveAssistantFirst } from '@web/lib/assistant-first';

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function Index(props: PageProps) {
  const params = await props.params;
  const { lang } = params;

  // #2486: the talk-first assistant is the app's default entry point. Everyone
  // (signed in or not) lands there unless they have opted into the classic app.
  if (await resolveAssistantFirst()) {
    redirect(`/${lang}/assistant`);
  }

  return <LandingPage lang={lang} />;
}
