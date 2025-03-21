'use client';

import { useAccount, useEnsName } from 'wagmi';
import { CreateSpaceForm } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';

export default function CreateSpacePage() {
  const { lang } = useParams();
  const { address } = useAccount();
  const { data, error, status } = useEnsName({ address });
  console.debug('CreateSpacePage', { address, data, error, status });

  return (
    <CreateSpaceForm
      isLoading={false}
      creator={{
        avatar: 'https://github.com/shadcn.png',
        name: 'Name',
        surname: 'Surname',
      }}
      closeUrl={`/${lang}/my-spaces`}
      onCreate={() => {}}
    />
  );
}
