import {
  ActivateProposalsBanner,
  ModalStickyNavigation,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { SelectCreateAction } from '../../../_components/select-create-action';
import { Locale } from '@hypha-platform/i18n';
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
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          closeDropSegment={PATH_SELECT_CREATE_ACTION}
          backToParent
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
