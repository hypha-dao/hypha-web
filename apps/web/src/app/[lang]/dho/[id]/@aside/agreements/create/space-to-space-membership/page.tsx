import { SidePanel } from '@hypha-platform/epics';
import { Locale } from '@hypha-platform/i18n';

type PageProps = {
  params: Promise<{ lang: Locale; id: string }>;
};

export default async function SpaceToSpaceMembershipPage({
  params,
}: PageProps) {
  return (
    <SidePanel>
      <></>
    </SidePanel>
  );
}
