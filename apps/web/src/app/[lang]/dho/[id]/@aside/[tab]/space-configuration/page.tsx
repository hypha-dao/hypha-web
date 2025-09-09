'use client';

import {
  useJwt,
  useMe,
  useSpaceBySlug,
  useUpdateSpaceOrchestrator,
} from '@hypha-platform/core/client';
import { SidePanel, SpaceForm } from '@hypha-platform/epics';
import { useParams, usePathname } from 'next/navigation';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { getDhoPathAgreements } from '../../../@tab/agreements/constants';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';

export default function SpaceConfiguration() {
  const { person } = useMe();
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space, isLoading: isLoadingSpace } = useSpaceBySlug(spaceSlug);
  const { jwt, isLoadingJwt } = useJwt();
  const router = useRouter();
  const { updateSpace, currentAction, isError, isPending, progress, reset } =
    useUpdateSpaceOrchestrator({ authToken: jwt });

  React.useEffect(() => {
    if (progress === 100 && !isPending && spaceSlug) {
      router.push(getDhoPathAgreements(lang as Locale, spaceSlug));
    }
  }, [progress, isPending, spaceSlug, lang]);

  const isBusy = isLoadingJwt || isLoadingSpace || isPending;

  const pathname = usePathname();
  const closeUrl = pathname.replace(/\/space-configuration$/, '');

  return (
    <SidePanel>
      <LoadingBackdrop
        progress={progress}
        isLoading={isBusy}
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
          submitLabel="Update"
          submitLoadingLabel="Updating..."
          isLoading={isBusy}
          closeUrl={closeUrl}
          backUrl={`${closeUrl}${PATH_SELECT_SETTINGS_ACTION}`}
          backLabel="Back to Settings"
          creator={{
            name: person?.name,
            surname: person?.surname,
          }}
          onSubmit={updateSpace}
          values={{
            ...space,
            title: space?.title || '',
            description: space?.description || '',
            slug: space?.slug || '',
            logoUrl: space?.logoUrl || '',
            leadImage: space?.leadImage || '',
            categories: space?.categories || [],
            links: space?.links || [],
            web3SpaceId: space?.web3SpaceId || undefined,
            parentId: space?.parentId || null,
            address: space?.address || '',
            flags: space?.flags || [],
          }}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
