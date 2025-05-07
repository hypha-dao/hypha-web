import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectSettingsAction } from '../../../_components/select-settings-action';
import { Locale } from '@hypha-platform/i18n';

export default async function SelectSettingsActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  return (
    <SidePanel>
      <ButtonClose dropSegment="select-settings-action" />
      <SelectSettingsAction lang={lang} daoSlug={daoSlug} />
    </SidePanel>
  );
}
