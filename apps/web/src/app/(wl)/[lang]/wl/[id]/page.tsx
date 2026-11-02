import { redirect } from 'next/navigation';
export default async function Index({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  redirect(`/${lang}/wl/${id}/overview`);
}
