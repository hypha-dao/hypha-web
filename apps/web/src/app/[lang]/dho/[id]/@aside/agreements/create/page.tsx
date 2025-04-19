'use client';

import { CreateAgreementForm, SidePanel } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { useMe } from '@hypha-platform/core/client';

export default function CreateAgreement() {
  const { lang, id } = useParams();
  const { person } = useMe();
  return (
    <SidePanel>
      <CreateAgreementForm
        creator={{
          avatar: person?.avatarUrl || '',
          name: person?.name || '',
          surname: person?.surname || '',
        }}
        closeUrl={`/${lang}/dho/${id}/agreements`}
        onCreate={() => {
          console.log('Publish proposal');
        }}
        isLoading={false}
      />
    </SidePanel>
  );
}
