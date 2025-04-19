import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { SelectCreateAction } from '../../../_components/select-create-action';
import { Locale } from '@hypha-platform/i18n';

export default async function SelectCreateActions({
  params,
}: {
  params: Promise<{ id: string; lang: Locale }>;
}) {
  const { id: daoSlug, lang } = await params;
  return (
    <SidePanel>
      <ButtonClose dropSegment="select-create-action" />
      <SelectCreateAction lang={lang} daoSlug={daoSlug} />
    </SidePanel>
  );
}
