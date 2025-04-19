'use client';

import { DocumentDetails, Chat, SidePanel } from '@hypha-platform/epics';

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
