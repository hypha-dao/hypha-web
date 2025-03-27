'use client';

import { CreateSpaceForm } from '@hypha-platform/epics';
import { SidePanel } from '../../_components/side-panel';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { getDhoPathAgreements } from '@web/app/[lang]/dho/[id]/agreements/constants';
import { Locale } from '@hypha-platform/i18n';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useCreateSpaceOrchestrator } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { useJwt } from '@web/hooks/use-jwt';
import { Button } from '@hypha-platform/ui';
import { useUploadThingFileUploader } from '@web/hooks/use-uploadthing-file-uploader';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();
  const config = useConfig();
  const { jwt, isLoadingJwt } = useJwt();
  const {
    reset,
    createSpace,
    currentAction,
    errors,
    isError,
    isPending,
    progress,
    space: { slug: spaceSlug },
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });

  console.debug('AsideCreateSpacePage', {
    isPending,
    isLoadingJwt,
    isError,
    progress,
    errors,
  });

  const newSpacePath = React.useMemo(
    () => (spaceSlug ? getDhoPathAgreements(lang as Locale, spaceSlug) : null),
    [spaceSlug],
  );

  const isDone = React.useMemo(() => {
    if (!isLoadingJwt && !!newSpacePath) return true;
  }, [isLoadingJwt, newSpacePath]);

  React.useEffect(() => {
    newSpacePath ? router.prefetch(newSpacePath) : null;
  }, [newSpacePath]);

  React.useEffect(() => {
    if (!isLoadingJwt && newSpacePath) {
      router.push(newSpacePath);
    }
  }, [newSpacePath, isLoadingJwt]);

  return isDone ? null : (
    <SidePanel>
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
          creator={{
            avatar: 'https://github.com/shadcn.png',
            name: 'Name',
            surname: 'Surname',
          }}
          closeUrl={`/${lang}/my-spaces`}
          onCreate={createSpace}
          isLoading={isLoadingJwt}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
