import {
  ActivateProposalsBanner,
  ModalStickyNavigation,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { SelectSettingsAction } from '../../../_components/select-settings-action';
import { Locale } from '@hypha-platform/i18n';
import {
  PATH_SELECT_ACTIVATE_ACTION,
  PATH_SELECT_SETTINGS_ACTION,
} from '@web/app/constants';

export default async function SelectSettingsActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id: daoSlug, lang, tab } = await params;
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          closeDropSegment={PATH_SELECT_SETTINGS_ACTION}
          backToParent
        />
        <SelectSettingsAction lang={lang} daoSlug={daoSlug} activeTab={tab}>
          <ActivateProposalsBanner
            spaceSlug={daoSlug}
            activatePath={PATH_SELECT_ACTIVATE_ACTION}
          />
        </SelectSettingsAction>
      </div>
    </ProposalOverlayShell>
  );
}
