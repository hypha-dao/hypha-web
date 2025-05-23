import { ButtonClose, SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function CreateChangeVotingMethodPage({
  params,
}: PageProps) {
  return (
    <SidePanel>
      <ButtonClose dropSegment="select-settings-action" />
      <div>Change voting method form</div>
    </SidePanel>
  );
}
