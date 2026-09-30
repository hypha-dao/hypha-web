import { Locale } from '@hypha-platform/i18n';

import { MemberHomePage } from './member-home-page';

export const metadata = {
  title: 'Home | Hypha',
  description:
    'Where you can be useful: your spaces, people, proposals, and wallet.',
};

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function HomePage(props: PageProps) {
  const { lang } = await props.params;
  return <MemberHomePage lang={lang} />;
}
