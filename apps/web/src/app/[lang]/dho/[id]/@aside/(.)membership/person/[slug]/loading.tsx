import { SidePanel } from '../../../_components/side-panel';
import { MemberDetail } from '@hypha-platform/epics';

export default function Loading() {
  return (
    <SidePanel>
      <MemberDetail
        member={{
          avatar: '',
          name: '',
          surname: '',
          nickname: '',
          commitment: 0,
          status: '',
          about: '',
          spaces: [],
          agreements: [],
        }}
        closeUrl=""
        agreements={[]}
        isLoading={true}
      />
    </SidePanel>
  );
}
