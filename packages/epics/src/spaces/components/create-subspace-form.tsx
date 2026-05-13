'use client';

import { useConfig } from 'wagmi';
import { SpaceForm } from './create-space-form';
import { useRouter } from 'next/navigation';
import {
  type Space,
  useCreateSpaceOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';
import { SpaceLoadingBackdrop } from './space-loading-backdrop';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useSWRConfig } from 'swr';

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
  const t = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const router = useRouter();
  const config = useConfig();
  const { person } = useMe();
  const { jwt } = useJwt();
  const { mutate } = useSWRConfig();
  const {
    createSpace,
    reset,
    currentAction,
    isError,
    isPending,
    progress,
    space: { slug: spaceSlug },
  } = useCreateSpaceOrchestrator({ authToken: jwt, config });
  const hasNavigatedAfterSuccessRef = React.useRef(false);
  const closeAfterSuccess = React.useCallback(() => {
    // In @aside parallel routes, the visible URL can already be the parent path.
    // Prefer history back to close the overlay state, then hard-fallback to replace.
    router.back();
    window.setTimeout(() => {
      router.replace(successfulUrl);
    }, 250);
  }, [router, successfulUrl]);
  const pendingNavigationSeedRef = React.useRef<{
    optimisticSpace: Space;
    organisationSpaces: Space[];
  } | null>(null);

  React.useEffect(() => {
    if (progress === 100 && !hasNavigatedAfterSuccessRef.current) {
      hasNavigatedAfterSuccessRef.current = true;
      void (async () => {
        const seed = pendingNavigationSeedRef.current;
        if (seed && spaceSlug) {
          const mutationResults = await Promise.allSettled([
            mutate(`/api/v1/spaces/${spaceSlug}`, seed.optimisticSpace, {
              revalidate: false,
            }),
            mutate(
              `/api/v1/spaces/${spaceSlug}/organisation`,
              seed.organisationSpaces,
              {
                revalidate: false,
              },
            ),
          ]);
          mutationResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              const key =
                index === 0
                  ? `/api/v1/spaces/${spaceSlug}`
                  : `/api/v1/spaces/${spaceSlug}/organisation`;
              console.error(
                '[CreateSubspaceForm] Failed to seed cache before navigation',
                {
                  key,
                  error: result.reason,
                },
              );
            }
          });
          pendingNavigationSeedRef.current = null;
        }
        closeAfterSuccess();
      })();
    }
  }, [closeAfterSuccess, mutate, progress, spaceSlug]);

  return (
    <SpaceLoadingBackdrop
      showKeepWindowOpenMessage={true}
      keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
      fullHeight={true}
      progress={progress}
      isLoading={isPending}
      message={
        isError ? (
          <div className="flex flex-col">
            <div>{t('errorOhSnap')}</div>
            <Button onClick={reset}>{t('reset')}</Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <SpaceForm
        isLoading={isPending || progress === 100}
        creator={{ name: person?.name, surname: person?.surname }}
        closeUrl={successfulUrl}
        backUrl={backUrl}
        backLabel={t('backToSettings')}
        onSubmit={(values, organisationSpaces) => {
          // Subspace creation does not use root-only ecosystem branding fields.
          const {
            ecosystemLogoUrlLight: _ecosystemLogoUrlLight,
            ecosystemLogoUrlDark: _ecosystemLogoUrlDark,
            ...createValues
          } = values;
          const normalizedParentId =
            createValues.parentId ?? parentSpaceId ?? null;
          const normalizedCreateValues = {
            ...createValues,
            parentId: normalizedParentId,
          };

          pendingNavigationSeedRef.current = {
            optimisticSpace: {
              id: -1,
              title: normalizedCreateValues.title,
              description: normalizedCreateValues.description,
              slug: normalizedCreateValues.slug || '',
              parentId: normalizedParentId,
              logoUrl:
                typeof normalizedCreateValues.logoUrl === 'string'
                  ? normalizedCreateValues.logoUrl
                  : null,
              leadImage:
                typeof normalizedCreateValues.leadImage === 'string'
                  ? normalizedCreateValues.leadImage
                  : null,
              ecosystemLogoUrlLight: null,
              ecosystemLogoUrlDark: null,
              web3SpaceId: null,
              links: normalizedCreateValues.links ?? [],
              categories: normalizedCreateValues.categories ?? [],
              flags: normalizedCreateValues.flags ?? ['sandbox'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            organisationSpaces: organisationSpaces ?? [],
          };

          return createSpace(normalizedCreateValues);
        }}
        initialParentSpaceId={parentSpaceId as number}
        parentSpaceSlug={parentSpaceSlug}
        label="add"
        slugIncorrectMessage={t('slugAlreadyExistsLong')}
      />
    </SpaceLoadingBackdrop>
  );
};
