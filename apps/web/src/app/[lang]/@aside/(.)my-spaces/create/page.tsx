'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams } from 'next/navigation';
import { Card } from '@hypha-platform/ui';
import React from 'react';
import { useCreateSpace } from '@web/hooks/use-create-space';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const {
    createSpace,
    hash,
    spaceId,
    isLoading,
    error,
    isWriteContractSuccess,
  } = useCreateSpace();

  return (
    <SidePanel>
      <CreateSpaceForm
        isLoading={isLoading}
        creator={{
          avatar: 'https://github.com/shadcn.png',
          name: 'Name',
          surname: 'Surname',
        }}
        closeUrl={`/${lang}/my-spaces`}
        onCreate={createSpace}
      />

      {error && (
        <Card className="mt-4 p-4 border-error-9 bg-error-2">
          <h3 className="font-medium text-error-11">Error</h3>
          <p className="text-sm text-error-10">{error.message}</p>
        </Card>
      )}

      {isWriteContractSuccess && (
        <Card className="mt-4 p-4 border-accent-9 bg-accent-2">
          <h3 className="font-medium text-accent-11">Transaction Submitted</h3>
          <div className="text-sm text-accent-10">
            {hash && <div>Transaction Hash: {hash}</div>}
            {spaceId && <div>Space ID: {spaceId}</div>}
          </div>
        </Card>
      )}
    </SidePanel>
  );
}
