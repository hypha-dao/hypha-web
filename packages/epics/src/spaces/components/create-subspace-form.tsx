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
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathOverview } from './space-card.container';

interface CreateSpaceFormProps {
  parentSpaceId: number | null;
  parentSpaceSlug: string;
  successfulUrl: string;
  backUrl?: string;
}

export const CreateSubspaceForm = ({
  successfulUrl,
  backUrl,
  parentSpaceId,
  parentSpaceSlug,
}: CreateSpaceFormProps) => {
  const { lang } = useParams();
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
      router.push(getDhoPathOverview(lang as Locale, spaceSlug));
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
        onSubmit={(values) => createSpace(values)}
        initialParentSpaceId={parentSpaceId as number}
        parentSpaceSlug={parentSpaceSlug}
        label="add"
        slugIncorrectMessage="A space with this name already exists. Please choose a different name for your space."
      />
    </LoadingBackdrop>
  );
};
