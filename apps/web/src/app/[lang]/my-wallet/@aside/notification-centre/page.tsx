import { redirect } from 'next/navigation';

// TODO: remove once old emails linking to /my-wallet/notification-centre are no longer in circulation.
export default async function LegacyNotificationCentrePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/my-wallet?dialog=notification-centre`);
}
