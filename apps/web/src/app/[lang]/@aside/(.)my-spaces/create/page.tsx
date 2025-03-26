'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();

  return (
    <SidePanel>
      <CreateSpaceForm
        isLoading={false}
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={`/${lang}/my-spaces`}
        onCreate={(values) => console.debug('AsideCreateSpacePage', { values })}
      />
    </SidePanel>
  );
}
