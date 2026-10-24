import { Locale } from '@hypha-platform/i18n';
import {
  findEnergyCommunityBySpaceId,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getDhoPathOverview } from './@tab/overview/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Index(props: PageProps) {
  const { lang, id } = await props.params;
  const query = await props.searchParams;
  // TEMP(#2575): the redirect below drops the query string (?signal=&msg=).
  const h = await headers();
  console.log('[#2575] SERVER dho/[id]/page.tsx redirect() running', {
    at: new Date().toISOString(),
    lang,
    id,
    droppedQuery: query,
    isRscRequest: h.get('rsc') === '1',
    isPrefetch: h.get('next-router-prefetch'),
    nextUrl: h.get('next-url'),
    referer: h.get('referer'),
  });
  const space = await findSpaceBySlug({ slug: id }, { db });
  if (space) {
    const energy = await findEnergyCommunityBySpaceId(space.id, { db });
    if (energy) redirect(`/${lang}/dho/${id}/energy`);
  }
  redirect(getDhoPathOverview(lang, id));
}
