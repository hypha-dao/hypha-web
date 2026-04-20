import {
  ModalStickyNavigation,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { SelectNavigationAction } from '../../../_components/select-navigation-action';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { PATH_SELECT_NAVIGATION_ACTION } from '@web/app/constants';

export default async function SelectNavigationActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id: daoSlug, lang } = await params;
  const tModalAside = await getTranslations('ModalAside');
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('spaceNavigation')}
          closeDropSegment={PATH_SELECT_NAVIGATION_ACTION}
          showBack={false}
        />
        <SelectNavigationAction lang={lang} daoSlug={daoSlug} />
      </div>
    </ProposalOverlayShell>
  );
}
