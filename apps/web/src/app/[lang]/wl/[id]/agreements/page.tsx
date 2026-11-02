import { DocumentsSections } from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
export default async function P({
  params,
}: {
  params: Promise<{ lang: any; id: string }>;
}) {
  const { lang, id } = await params;
  const space = await findSpaceBySlug({ slug: id }, { db });
  if (!space?.web3SpaceId) return notFound();
  return (
    <DocumentsSections
      lang={lang}
      spaceSlug={id}
      web3SpaceId={space.web3SpaceId}
      order={[{ name: 'createdAt', dir: DirectionType.DESC }]}
    />
  );
}
