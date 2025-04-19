'use client';

import { CreateForm, SidePanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathAgreements } from '../../../@tab/agreements/constants';
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
        closeUrl={getDhoPathAgreements(lang as Locale, id as string)}
        type="Discussion"
      />
    </SidePanel>
  );
}
