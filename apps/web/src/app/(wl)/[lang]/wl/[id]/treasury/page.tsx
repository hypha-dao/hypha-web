import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { TreasuryTabs } from '@web/app/(main)/[lang]/dho/[id]/_components/treasury-tabs';
export default async function P({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const space = await findSpaceBySlug({ slug: id }, { db });
  return (
    <TreasuryTabs
      basePath={`/${lang}/wl/${id}/treasury`}
      spaceSlug={id}
      web3SpaceId={space?.web3SpaceId as number}
    />
  );
}
