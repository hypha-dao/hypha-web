'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

export default function CreateSpacePage() {
  const { lang } = useParams();

  return (
    <CreateSpaceForm
      isLoading={false}
      creator={{
        avatar: 'https://github.com/shadcn.png',
        name: 'Name',
        surname: 'Surname',
      }}
      closeUrl={`/${lang}/my-spaces`}
      onCreate={(values) => console.debug('CreateSpacePage', { values })}
    />
  );
}
