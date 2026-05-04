import { Locale } from '@hypha-platform/i18n';
import {
  DocumentsSections,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import { getSpaceBySlug } from '@hypha-platform/core/server';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TabScreenTitle } from '../_components/tab-screen-title';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function AgreementsPage(props: PageProps) {
  const params = await props.params;
  const tCommon = await getTranslations('Common');

  const { lang, id } = params;

  // TODO: implement authorization
  const spaceFromDb = await getSpaceBySlug({ slug: id });

  if (!spaceFromDb) {
    return notFound();
  }

  const web3SpaceId = spaceFromDb.web3SpaceId;
  if (web3SpaceId == null) {
    return notFound();
  }

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle
          title={tCommon('Agreements')}
          count={spaceFromDb?.documentCount ?? null}
        />
        <DocumentsSections
          lang={lang}
          spaceSlug={id}
          web3SpaceId={web3SpaceId}
          order={[
            {
              name: 'createdAt',
              dir: DirectionType.DESC,
            },
          ]}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
