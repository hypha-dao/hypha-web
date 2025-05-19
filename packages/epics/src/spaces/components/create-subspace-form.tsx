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
  parentSpaceId: number | null | undefined;
  successfulUrl: string;
}

export const CreateSubspaceForm = ({
  successfulUrl,
  parentSpaceId,
}: CreateSpaceFormProps) => {
  const { lang, id } = useParams();
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
      className="-m-9"
    >
      <SpaceForm
        isLoading={false}
        creator={{ name: person?.name, surname: person?.surname }}
        closeUrl={`/${lang}/dho/${id}/membership`}
        onSubmit={createSpace}
        parentSpaceId={parentSpaceId as number}
      />
    </LoadingBackdrop>
  );
};
