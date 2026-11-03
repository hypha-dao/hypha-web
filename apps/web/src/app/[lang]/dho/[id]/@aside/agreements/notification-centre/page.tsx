import { redirect } from 'next/navigation';

// TODO: remove once old emails linking to /dho/<id>/<tab>/notification-centre are no longer in circulation.
export default async function LegacyNotificationCentrePage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  redirect(`/${lang}/dho/${id}/agreements?dialog=notification-centre`);
}
