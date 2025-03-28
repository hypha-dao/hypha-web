'use client';

import { SidePanel } from '../../_components/side-panel';
import { DocumentDetails, Chat } from '@hypha-platform/epics';

type PageProps = {
  params: Promise<{ slug: string; id: string; lang: string }>;
};

export default function Agreements(props: PageProps) {
  return (
    <SidePanel>
      <DocumentDetails
        creator={{
          avatarUrl: '',
          name: '',
          surname: '',
        }}
        title={''}
        isLoading={true}
        description={''}
        leadImage={''}
        closeUrl={''}
        badges={[]}
        interactions={<Chat messages={[]} />}
      />
    </SidePanel>
  );
}
