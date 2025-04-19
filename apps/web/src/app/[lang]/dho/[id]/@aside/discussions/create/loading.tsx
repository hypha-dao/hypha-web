import { CreateForm, SidePanel } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <CreateForm
        isLoading={true}
        creator={{
          avatar: '',
          name: '',
          surname: '',
        }}
        closeUrl={''}
        type="Discussion"
      />
    </SidePanel>
  );
}
