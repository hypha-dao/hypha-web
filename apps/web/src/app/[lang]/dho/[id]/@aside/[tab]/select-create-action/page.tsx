import {
  ActivateProposalsBanner,
  ButtonClose,
  SidePanel,
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
    <SidePanel>
      <div className="relative">
        <ButtonClose
          dropSegment={PATH_SELECT_CREATE_ACTION}
          className="absolute top-0 right-0"
        />
        <SelectCreateAction lang={lang} daoSlug={daoSlug}>
          <ActivateProposalsBanner
            spaceSlug={daoSlug}
            activatePath={PATH_SELECT_ACTIVATE_ACTION}
          />
        </SelectCreateAction>
      </div>
    </SidePanel>
  );
}
