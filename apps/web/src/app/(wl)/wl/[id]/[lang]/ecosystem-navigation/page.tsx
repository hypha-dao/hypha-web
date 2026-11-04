import { notFound } from 'next/navigation';
import { SpaceTabAccessWrapper } from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

import { EcosystemNavigationMainPanel } from '@web/app/(main)/[lang]/dho/[id]/_components/ecosystem-navigation-main-panel';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelEcosystemNavigationPage(
  props: WhiteLabelPageProps,
) {
  const { id: slug, lang } = await props.params;
  const space = await getWhiteLabelSpace(slug);
  if (typeof space.web3SpaceId !== 'number') notFound();

  return (
    <SpaceTabAccessWrapper spaceId={space.web3SpaceId} spaceSlug={slug}>
      <EcosystemNavigationMainPanel daoSlug={slug} lang={lang as Locale} />
    </SpaceTabAccessWrapper>
  );
}
