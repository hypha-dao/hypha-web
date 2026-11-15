import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MembersSection, SpaceTabAccessWrapper } from '@hypha-platform/epics';

import { useMembers } from '@web/hooks/use-members';
import { TabScreenTitle } from '@web/app/(main)/[lang]/dho/[id]/@tab/_components/tab-screen-title';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelMembersPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug, lang } = await props.params;
  const tCommon = await getTranslations('Common');
  const space = await getWhiteLabelSpace(slug);
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) notFound();

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={slug}>
      <div className="flex flex-col gap-4 py-4">
        <TabScreenTitle
          title={tCommon('Members')}
          count={space.memberCount ?? null}
          lang={lang}
        />
        {/* The card link is a main-app href; the link guard maps it to the person overlay. */}
        <MembersSection
          basePath={`/${lang}/dho/${slug}/members/person`}
          useMembers={useMembers}
          spaceSlug={slug}
          refreshInterval={5000}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
