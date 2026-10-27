import { redirect } from 'next/navigation';

// TODO: remove once old emails linking to /profile/<slug>/notification-centre are no longer in circulation.
export default async function LegacyNotificationCentrePage({
  params,
}: {
  params: Promise<{ lang: string; personSlug: string }>;
}) {
  const { lang, personSlug } = await params;
  redirect(`/${lang}/profile/${personSlug}?dialog=notification-centre`);
}
