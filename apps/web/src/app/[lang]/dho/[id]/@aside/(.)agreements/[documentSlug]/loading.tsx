import { AgreementDetail } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';

export default function Loading() {
  return (
    <SidePanel>
      <AgreementDetail
        closeUrl={''}
        onSetActiveFilter={() => console.log('set active filter')}
        content={''}
        creator={{
          avatarUrl:
            '',
          name: '',
          surname: '',
        }}
        title={''}
        commitment={0}
        status={''}
        isLoading={true}
        comments={[]}
      />
    </SidePanel>
  );
}
