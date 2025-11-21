'use client';

import {
  Space,
  useJwt,
  useMe,
  useSpaceBySlug,
  useUpdateSpaceOrchestrator,
} from '@hypha-platform/core/client';
import {
  getDhoPathOverview,
  SchemaCreateSpaceForm,
  SidePanel,
  SpaceForm,
} from '@hypha-platform/epics';
import { useParams, usePathname } from 'next/navigation';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
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
  const [newSpaceSlug, setNewSpaceSlug] = React.useState(spaceSlug);

  React.useEffect(() => {
    if (progress === 100 && !isPending && newSpaceSlug) {
      router.push(getDhoPathOverview(lang as Locale, newSpaceSlug));
    }
  }, [progress, isPending, newSpaceSlug, lang]);

  const isBusy = isLoadingJwt || isLoadingSpace || isPending;

  const pathname = usePathname();
  const closeUrl = pathname.replace(/\/space-configuration$/, '');

  const submitForm = React.useCallback(
    async (
      updatedSpace: SchemaCreateSpaceForm,
      organisationSpaces?: Space[],
    ) => {
      try {
        if (space) {
          if (!space.parentId && updatedSpace.parentId) {
            const foundInnerSpace = organisationSpaces?.find(
              (inner) => inner.id === updatedSpace.parentId,
            );
            if (foundInnerSpace) {
              const {
                id,
                description,
                address,
                web3SpaceId,
                slug,
                ...updates
              } = foundInnerSpace;
              await updateSpace({
                id,
                data: {
                  ...updates,
                  slug,
                  parentId: null,
                  description: description as string | undefined,
                  address: address as string | undefined,
                  web3SpaceId: web3SpaceId as number | undefined,
                },
              });
            }
          }
          setNewSpaceSlug(updatedSpace.slug || '');
          await updateSpace({ id: space.id, data: updatedSpace });
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [space, updateSpace],
  );

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
          onSubmit={submitForm}
          slugIncorrectMessage="A space with this link already exists. Please choose a different space name or unique link."
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
          label="configure"
          initialParentSpaceId={space?.parentId ?? null}
          spaceId={space?.id}
        />
      </LoadingBackdrop>
    </SidePanel>
  );
}
