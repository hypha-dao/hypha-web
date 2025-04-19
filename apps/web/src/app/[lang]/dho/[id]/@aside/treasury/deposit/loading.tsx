import { DepositFunds, SidePanel } from '@hypha-platform/epics';

export default async function Treasury() {
  return (
    <SidePanel>
      <DepositFunds closeUrl={''} spaceId={0} isLoading />
    </SidePanel>
  );
}
