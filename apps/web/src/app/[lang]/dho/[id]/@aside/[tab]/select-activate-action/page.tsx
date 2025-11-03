import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectActivateAction } from '../../../_components/select-activate-action';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_ACTIVATE_ACTION } from '@web/app/constants';

export default async function SelectActivateActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id: daoSlug, lang, tab } = await params;
  return (
    <SidePanel>
      <div className="relative">
        <ButtonClose
          dropSegment={PATH_SELECT_ACTIVATE_ACTION}
          className="absolute top-0 right-0"
        />
        <SelectActivateAction lang={lang} daoSlug={daoSlug} activeTab={tab} />
      </div>
    </SidePanel>
  );
}
