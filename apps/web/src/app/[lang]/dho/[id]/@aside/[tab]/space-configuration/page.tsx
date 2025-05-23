'use client';

import {
  useJwt,
  useMe,
  useSpaceBySlug,
  useUpdateSpaceOrchestrator,
} from '@hypha-platform/core/client';
import { SidePanel, SpaceForm } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { getDhoPathGovernance } from '../../../@tab/governance/constants';
import { Locale } from '@hypha-platform/i18n';

export default function SpaceConfiguration() {
  const { person } = useMe();
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space, isLoading } = useSpaceBySlug(spaceSlug);
  const { jwt, isLoadingJwt } = useJwt();
  const router = useRouter();
  const {
    updateSpace,
    isMutating,
    currentAction,
    isError,
    isPending,
    progress,
    reset,
  } = useUpdateSpaceOrchestrator({ authToken: jwt });

  React.useEffect(() => {
    if (progress === 100 && spaceSlug) {
      router.push(getDhoPathGovernance(lang as Locale, spaceSlug));
    }
  }, [progress, spaceSlug]);

  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isPending || isLoading}
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
          submitLabel="Update"
          submitLoadingLabel="Updating..."
          isLoading={isLoadingJwt || isLoading || isMutating}
          closeUrl={getDhoPathGovernance(lang as Locale, spaceSlug)}
          creator={{
            name: person?.name,
            surname: person?.surname,
          }}
          onSubmit={updateSpace}
          defaultValues={{
            ...space,
            title: space?.title || '',
            description: space?.description || '',
            slug: spaceSlug,
            logoUrl: space?.logoUrl || '',
            leadImage: space?.leadImage || '',
            categories: space?.categories || [],
            links: space?.links || [],
            web3SpaceId: space?.web3SpaceId || undefined,
          }}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
