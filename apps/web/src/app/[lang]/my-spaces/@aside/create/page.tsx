'use client';

import {
  SpaceForm,
  SidePanel,
  getDhoPathAgreements,
} from '@hypha-platform/epics';
import { useParams, useRouter, usePathname } from 'next/navigation';
import React from 'react';
import { Locale } from '@hypha-platform/i18n';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import {
  useCreateSpaceOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import { useConfig } from 'wagmi';
import { Button } from '@hypha-platform/ui';

export default function AsideCreateSpacePage() {
  const { lang } = useParams();
  const router = useRouter();
  const config = useConfig();
  const { person } = useMe();
  const { jwt, isLoadingJwt } = useJwt();
  const pathname = usePathname();
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

  const closeUrl = pathname.split('/').slice(0, -1).join('/') || '/';

  return progress !== 100 ? (
    <SidePanel>
      <LoadingBackdrop
        fullHeight={true}
        showKeepWindowOpenMessage={true}
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
      >
        <SpaceForm
          creator={{
            name: person?.name,
            surname: person?.surname,
          }}
          closeUrl={closeUrl}
          backUrl={closeUrl}
          backLabel="Back"
          onSubmit={(values) => createSpace(values)}
          isLoading={isLoadingJwt}
          label="create"
          slugIncorrectMessage="A space with this name already exists. Please choose a different name for your space."
        />
      </LoadingBackdrop>
    </SidePanel>
  ) : null;
}
