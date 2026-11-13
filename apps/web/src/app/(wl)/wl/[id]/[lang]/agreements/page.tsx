import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  DocumentsSections,
  SpaceTabAccessWrapper,
} from '@hypha-platform/epics';
import { DirectionType } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';

import { TabScreenTitle } from '@web/app/(main)/[lang]/dho/[id]/@tab/_components/tab-screen-title';
import {
  getWhiteLabelSpace,
  type WhiteLabelPageProps,
} from '../../../../_lib/space';

export default async function WhiteLabelAgreementsPage(
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
          title={tCommon('Agreements')}
          count={space.documentCount ?? null}
          lang={lang}
        />
        <DocumentsSections
          lang={lang as Locale}
          spaceSlug={slug}
          web3SpaceId={web3SpaceId}
          order={[{ name: 'createdAt', dir: DirectionType.DESC }]}
        />
      </div>
    </SpaceTabAccessWrapper>
  );
}
