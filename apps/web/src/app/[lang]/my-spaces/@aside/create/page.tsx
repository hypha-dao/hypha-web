'use client';

import { CreateSpaceForm, SidePanel } from '@hypha-platform/epics';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Locale } from '@hypha-platform/i18n';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { useCreateSpaceOrchestrator } from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { useJwt } from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '@web/app/[lang]/dho/[id]/@tab/agreements/constants';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();
  const config = useConfig();
  const { person } = useMe();
  const { jwt, isLoadingJwt } = useJwt();
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
      router.push(getDhoPathAgreements(lang as Locale, spaceSlug));
    }
  }, [progress, spaceSlug]);

  return progress !== 100 ? (
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
            name: person?.name,
            surname: person?.surname,
          }}
          closeUrl={`/${lang}/my-spaces`}
          onCreate={createSpace}
          isLoading={isLoadingJwt}
        />
      </LoadingBackdrop>
    </SidePanel>
  ) : null;
}
