import { ButtonClose, ProposalOverlayShell } from '@hypha-platform/epics';
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
      <div className="relative">
        <ButtonClose
          dropSegment={PATH_SELECT_NAVIGATION_ACTION}
          className="absolute top-0 right-0"
        />
        <SelectNavigationAction lang={lang} daoSlug={daoSlug} />
      </div>
    </ProposalOverlayShell>
  );
}
