import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';

import { MemberHomeAttentionRoute } from '../../my-dashboard/attention/attention-route';

export async function generateMetadata() {
  const t = await getTranslations('MemberHome');
  return {
    title: t('waiting'),
  };
}

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function AttentionPage(props: PageProps) {
  const { lang } = await props.params;
  return <MemberHomeAttentionRoute lang={lang} />;
}
