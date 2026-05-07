import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { EcosystemNavigationMainPanel } from '../../_components/ecosystem-navigation-main-panel';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function EcosystemNavigationPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;
  let spaceFromDb: Awaited<ReturnType<typeof findSpaceBySlug>> = null;
  try {
    spaceFromDb = await findSpaceBySlug({ slug: id }, { db });
  } catch (error) {
    console.error('[ecosystem-navigation/page] Failed to load space by slug', {
      error,
      slug: id,
    });
  }

  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId = spaceFromDb.web3SpaceId;
  if (typeof web3SpaceId !== 'number') {
    return notFound();
  }

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <EcosystemNavigationMainPanel daoSlug={id} lang={lang} />
    </SpaceTabAccessWrapper>
  );
}
