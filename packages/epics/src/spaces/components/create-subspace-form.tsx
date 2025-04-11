'use client';

import { useConfig } from 'wagmi';
import { CreateSpaceForm } from './create-space-form';
import { useParams, useRouter } from 'next/navigation';
import { useJwt } from '@web/hooks/use-jwt';
import { useCreateSpaceOrchestrator } from '@hypha-platform/core/client';
import React from 'react';
import { Locale } from '@hypha-platform/i18n';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useMe } from '@web/hooks/use-me';

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
      <CreateSpaceForm
        isLoading={false}
        creator={{ name: person?.name, surname: person?.surname }}
        closeUrl={`/${lang}/dho/${id}/membership`}
        onCreate={createSpace}
        parentSpaceId={parentSpaceId as number}
      />
    </LoadingBackdrop>
  );
};
