'use client';

import { CreateForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';
import { Paths } from '@hypha-platform/tools';
import { Locale } from '@hypha-platform/i18n';

export default function Loading() {
  const { id, lang } = useParams();

  return (
    <SidePanel>
      <CreateForm
        isLoading={false}
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={Paths.dho.agreements(lang as Locale, id as string)}
        type="Discussion"
      />
    </SidePanel>
  );
}
