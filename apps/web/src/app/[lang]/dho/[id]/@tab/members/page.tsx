import { Locale } from '@hypha-platform/i18n';
import { MembersSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';
import { getSpaceBySlug } from '@hypha-platform/core/server';
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

  const basePath = getDhoPathMembers(lang as Locale, id as string);

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId as number} spaceSlug={id}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle
          title={tCommon('Members')}
          count={spaceFromDb?.memberCount ?? null}
        />
        <MembersSection
          basePath={`${basePath}/person`}
          useMembers={useMembers}
          spaceSlug={id}
          refreshInterval={2000}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
