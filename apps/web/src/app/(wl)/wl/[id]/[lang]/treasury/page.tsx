import { notFound } from 'next/navigation';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';

import { TreasuryTabs } from '@web/app/(main)/[lang]/dho/[id]/_components/treasury-tabs';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelTreasuryPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug, lang } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  const web3SpaceId = space.web3SpaceId;
  if (web3SpaceId == null) notFound();

  return (
    <SpaceTabAccessWrapper spaceId={web3SpaceId} spaceSlug={slug}>
      <TreasuryTabs
        basePath={`/${lang}/dho/${slug}/treasury`}
        spaceSlug={slug}
        web3SpaceId={web3SpaceId}
      />
    </SpaceTabAccessWrapper>
  );
}
