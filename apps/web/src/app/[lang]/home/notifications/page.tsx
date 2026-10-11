import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';

import { MemberHomeNotificationsRoute } from '../../my-dashboard/notifications/notifications-route';

export async function generateMetadata() {
  const t = await getTranslations('MemberHome');
  return {
    title: t('notifications'),
  };
}

type PageProps = {
  params: Promise<{ lang: Locale }>;
};

export default async function NotificationsPage(props: PageProps) {
  const { lang } = await props.params;
  return <MemberHomeNotificationsRoute lang={lang} />;
}
