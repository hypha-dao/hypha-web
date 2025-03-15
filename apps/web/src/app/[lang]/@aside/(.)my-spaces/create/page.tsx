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

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();
  const config = useConfig();
  const { jwt } = useJwt();
  const {
    createSpace,
    currentAction,
    progress,
    isPending,
    isLoading,
    isError,
    errors,
    space: { slug: spaceSlug },
    reset,
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });
  console.debug('AsideCreateSpacePage', {
    isPending,
    isLoading,
    isError,
    progress,
    errors,
  });

  const newSpacePath = React.useMemo(
    () => (spaceSlug ? getDhoPathAgreements(lang as Locale, spaceSlug) : null),
    [spaceSlug],
  );

  const isDone = React.useMemo(() => {
    if (!isLoading && !!newSpacePath) return true;
  }, [isLoading, newSpacePath]);

  React.useEffect(() => {
    newSpacePath ? router.prefetch(newSpacePath) : null;
  }, [newSpacePath]);

  React.useEffect(() => {
    if (!isLoading && newSpacePath) {
      router.push(newSpacePath);
    }
  }, [newSpacePath, isLoading]);

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
          isLoading={isLoading}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
