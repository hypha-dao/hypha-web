import { Locale } from '@hypha-platform/i18n';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { notFound } from 'next/navigation';
import { TabScreenTitle } from '../_components/tab-screen-title';
import { EcosystemNavigationMainPanel } from '../../_components/ecosystem-navigation-main-panel';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function EcosystemNavigationPage(props: PageProps) {
  const params = await props.params;
  const { lang, id } = params;
  const spaceFromDb = await findSpaceBySlug({ slug: id }, { db });

  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId = spaceFromDb.web3SpaceId;

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId as number} spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle title="Ecosystem" />
        <EcosystemNavigationMainPanel daoSlug={id} lang={lang} />
      </div>
    </SpaceTabAccessWrapper>
  );
}
