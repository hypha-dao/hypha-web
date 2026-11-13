import {
  ActivateProposalsBanner,
  ModalStickyNavigation,
  ProposalOverlayShell,
  SpaceSettingsButton,
} from '@hypha-platform/epics';
import { SelectCreateAction } from '../../../_components/select-create-action';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import {
  PATH_SELECT_ACTIVATE_ACTION,
  PATH_SELECT_CREATE_ACTION,
} from '@web/app/constants';

export default async function SelectCreateActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  const tModalAside = await getTranslations('ModalAside');
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('createProposal')}
          closeDropSegment={PATH_SELECT_CREATE_ACTION}
          backToParent
          beforeNavActions={
            <SpaceSettingsButton
              href={`/${lang}/dho/${daoSlug}/agreements/select-settings-action`}
              variant="chrome"
            />
          }
        />
        <SelectCreateAction lang={lang} daoSlug={daoSlug}>
          <ActivateProposalsBanner
            spaceSlug={daoSlug}
            activatePath={PATH_SELECT_ACTIVATE_ACTION}
          />
        </SelectCreateAction>
      </div>
    </ProposalOverlayShell>
  );
}
