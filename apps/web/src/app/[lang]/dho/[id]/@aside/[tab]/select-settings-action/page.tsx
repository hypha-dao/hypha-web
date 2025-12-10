import {
  ActivateProposalsBanner,
  ButtonClose,
  SidePanel,
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
    <SidePanel>
      <div className="relative">
        <ButtonClose
          dropSegment={PATH_SELECT_SETTINGS_ACTION}
          className="absolute top-0 right-0"
        />
        <SelectSettingsAction lang={lang} daoSlug={daoSlug} activeTab={tab}>
          <ActivateProposalsBanner
            spaceSlug={daoSlug}
            activatePath={PATH_SELECT_ACTIVATE_ACTION}
          />
        </SelectSettingsAction>
      </div>
    </SidePanel>
  );
}
