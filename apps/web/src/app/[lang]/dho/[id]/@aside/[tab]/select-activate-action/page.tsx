import {
  ModalStickyNavigation,
  ProposalOverlayShell,
} from '@hypha-platform/epics';
import { SelectActivateAction } from '../../../_components/select-activate-action';
import { Locale } from '@hypha-platform/i18n';
import { getTranslations } from 'next-intl/server';
import { PATH_SELECT_ACTIVATE_ACTION } from '@web/app/constants';

export default async function SelectActivateActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale; tab: string }>;
}) {
  const { id: daoSlug, lang, tab } = await params;
  const tModalAside = await getTranslations('ModalAside');
  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('activateSpace')}
          closeDropSegment={PATH_SELECT_ACTIVATE_ACTION}
          backToParent
        />
        <SelectActivateAction lang={lang} daoSlug={daoSlug} activeTab={tab} />
      </div>
    </ProposalOverlayShell>
  );
}
