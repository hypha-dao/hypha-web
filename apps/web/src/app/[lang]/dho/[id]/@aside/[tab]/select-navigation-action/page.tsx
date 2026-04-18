import {
  ModalStickyNavigation,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { SelectNavigationAction } from '../../../_components/select-navigation-action';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_NAVIGATION_ACTION } from '@web/app/constants';

export default async function SelectNavigationActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id: daoSlug, lang } = await params;
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          closeDropSegment={PATH_SELECT_NAVIGATION_ACTION}
          backToParent
        />
        <SelectNavigationAction lang={lang} daoSlug={daoSlug} />
      </div>
    </ProposalOverlayShell>
  );
}
