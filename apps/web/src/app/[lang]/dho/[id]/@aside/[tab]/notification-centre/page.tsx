import { redirect } from 'next/navigation';

// TODO: remove once old emails linking to /dho/<id>/<tab>/notification-centre are no longer in circulation.
export default async function LegacyNotificationCentrePage({
  params,
}: {
  params: Promise<{ lang: string; id: string; tab: string }>;
}) {
  const { lang, id, tab } = await params;
  redirect(`/${lang}/dho/${id}/${tab}?dialog=notification-centre`);
}
