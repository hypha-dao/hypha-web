import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';

import { MemberHomePage } from '../my-dashboard/member-home-page';

export async function generateMetadata() {
  const t = await getTranslations('MemberHome');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function HomePage(props: PageProps) {
  const { lang } = await props.params;
  return <MemberHomePage lang={lang} />;
}
