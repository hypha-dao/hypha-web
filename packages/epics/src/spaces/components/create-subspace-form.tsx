'use client';

import { useConfig } from 'wagmi';
import { SpaceForm } from './create-space-form';
import { useParams, useRouter } from 'next/navigation';
import { useJwt } from '@hypha-platform/core/client';
import { useCreateSpaceOrchestrator } from '@hypha-platform/core/client';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';

interface CreateSpaceFormProps {
  parentSpaceId: number | null;
  successfulUrl: string;
  backUrl?: string;
}

export const CreateSubspaceForm = ({
  successfulUrl,
  backUrl,
  parentSpaceId,
}: CreateSpaceFormProps) => {
  const router = useRouter();
  const config = useConfig();
  const { person } = useMe();
  const { jwt } = useJwt();
  const {
    createSpace,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    space: { slug: spaceSlug },
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });

  React.useEffect(() => {
    if (progress === 100 && spaceSlug) {
      router.push(successfulUrl);
    }
  }, [progress, spaceSlug]);

  return (
    <LoadingBackdrop
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>Ouh Snap. There was an error</div>
            <Button onClick={reset}>Reset</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
      className="-m-4 lg:-m-7"
    >
      <SpaceForm
        isLoading={false}
        creator={{ name: person?.name, surname: person?.surname }}
        closeUrl={successfulUrl}
        backUrl={backUrl}
        backLabel="Back to Settings"
        onSubmit={createSpace}
        parentSpaceId={parentSpaceId as number}
      />
    </LoadingBackdrop>
  );
};
