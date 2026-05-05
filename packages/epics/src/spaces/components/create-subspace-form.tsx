'use client';

import { useConfig } from 'wagmi';
import { SpaceForm } from './create-space-form';
import { useParams, useRouter } from 'next/navigation';
import {
  type Space,
  useCreateSpaceOrchestrator,
  useJwt,
  useMe,
} from '@hypha-platform/core/client';
import React from 'react';
import { SpaceLoadingBackdrop } from './space-loading-backdrop';
import { Button } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import { getDhoPathAgreements } from '../../common';
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
  const { lang } = useParams();
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
  const pendingNavigationSeedRef = React.useRef<{
    optimisticSpace: Space;
    organisationSpaces: Space[];
  } | null>(null);

  React.useEffect(() => {
    if (progress === 100 && spaceSlug) {
      void (async () => {
        const seed = pendingNavigationSeedRef.current;
        if (seed) {
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
        router.push(getDhoPathAgreements(lang as Locale, spaceSlug));
      })();
    }
  }, [lang, mutate, progress, router, spaceSlug]);

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
        isLoading={false}
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

          pendingNavigationSeedRef.current = {
            optimisticSpace: {
              id: -1,
              title: createValues.title,
              description: createValues.description,
              slug: createValues.slug || '',
              parentId: parentSpaceId,
              logoUrl:
                typeof createValues.logoUrl === 'string'
                  ? createValues.logoUrl
                  : null,
              leadImage:
                typeof createValues.leadImage === 'string'
                  ? createValues.leadImage
                  : null,
              ecosystemLogoUrlLight: null,
              ecosystemLogoUrlDark: null,
              web3SpaceId: null,
              links: createValues.links ?? [],
              categories: createValues.categories ?? [],
              flags: createValues.flags ?? ['sandbox'],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            organisationSpaces: organisationSpaces ?? [],
          };

          return createSpace(createValues);
        }}
        initialParentSpaceId={parentSpaceId as number}
        parentSpaceSlug={parentSpaceSlug}
        label="add"
        slugIncorrectMessage={t('slugAlreadyExistsLong')}
      />
    </SpaceLoadingBackdrop>
  );
};
