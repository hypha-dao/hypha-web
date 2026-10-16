import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import {
  findEnergyCommunityBySpaceSlug,
  getSpaceBySlug,
  isMissingEnergyCommunitiesTableError,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { getTranslations } from 'next-intl/server';

import { useMembers } from '@web/hooks/use-members';

import { getDhoPathMembers } from './constants';
import { TabScreenTitle } from '../_components/tab-screen-title';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function MembershipPage(props: PageProps) {
  const params = await props.params;
  const tCommon = await getTranslations('Common');

  const { lang, id } = params;

  const spaceFromDb = await getSpaceBySlug({ slug: id });
  const web3SpaceId = spaceFromDb?.web3SpaceId;

  let energySharingOnly = false;
  try {
    const energyCommunity = await findEnergyCommunityBySpaceSlug(id, { db });
    energySharingOnly = Boolean(energyCommunity);
  } catch (error) {
    if (!isMissingEnergyCommunitiesTableError(error)) throw error;
  }

  const basePath = getDhoPathMembers(lang as Locale, id as string);

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId as number} spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle
          title={tCommon('Members')}
          count={energySharingOnly ? null : spaceFromDb?.memberCount ?? null}
          lang={lang}
        />
        <MembersSection
          basePath={`${basePath}/person`}
          useMembers={useMembers}
          spaceSlug={id}
          refreshInterval={5000}
          energySharingOnly={energySharingOnly}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
