import { notFound } from 'next/navigation';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

import { RewardsMainPanel } from '@web/app/(main)/[lang]/dho/[id]/_components/rewards-main-panel';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelRewardsPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug, lang } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) notFound();

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={slug}>
      <RewardsMainPanel
        lang={lang as Locale}
        spaceSlug={slug}
        web3SpaceId={web3SpaceId}
      />
    </SpaceTabAccessWrapper>
  );
}
