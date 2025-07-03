import { Locale } from '@hypha-platform/i18n';
import { DocumentsSections } from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import { findSpaceBySlug, getDb } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;

  const { lang, id } = params;

  const spaceFromDb = await findSpaceBySlug(
    { slug: id },
    { db: getDb({ authToken: undefined }) },
  );

  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId = spaceFromDb.web3SpaceId;

  return (
    <DocumentsSections
      lang={lang}
      spaceSlug={id}
      web3SpaceId={web3SpaceId as number}
      order={[
        {
          name: 'createdAt',
          dir: DirectionType.DESC,
        },
      ]}
    />
  );
}
