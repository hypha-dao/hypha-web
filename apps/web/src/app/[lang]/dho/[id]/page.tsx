import { Locale } from '@hypha-platform/i18n';
import {
  findEnergyCommunityBySpaceId,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { redirect } from 'next/navigation';
import { getDhoPathOverview } from './@tab/overview/constants';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function Index(props: PageProps) {
  const { lang, id } = await props.params;
  const space = await findSpaceBySlug({ slug: id }, { db });
  if (space) {
    const energy = await findEnergyCommunityBySpaceId(space.id, { db });
    if (energy) redirect(`/${lang}/dho/${id}/energy`);
  }
  redirect(getDhoPathOverview(lang, id));
}
