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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitBlockError, setSubmitBlockError] = React.useState<string | null>(
    null,
  );
  const hasNavigatedAfterSuccessRef = React.useRef(false);
  const resolveSuccessUrl = React.useCallback(
    (targetSpaceSlug?: string) => {
      const baseUrl = targetSpaceSlug
        ? // Keep current context path (e.g. /ecosystem-navigation) but switch slug.
          successfulUrl.replace(
            /(\/dho\/)([^/]+)(?=\/|$)/,
            `$1${targetSpaceSlug}`,
          )
        : successfulUrl;

      // Some entry points (space settings -> add space) resolve to /en/dho/<slug>
      // which has no active tab content; normalize to ecosystem view.
      if (/\/dho\/[^/]+\/?$/.test(baseUrl)) {
        return `${baseUrl.replace(/\/$/, '')}/ecosystem-navigation`;
      }

      return baseUrl;
    },
    [successfulUrl],
  );
  const closeAfterSuccess = React.useCallback(
    (targetUrl: string) => {
      // In @aside parallel routes, the visible URL can already be the parent path.
      // Prefer history back to close the overlay state, then hard-fallback to a
      // full navigation so parallel-route state is always cleared.
      router.back();
      window.setTimeout(() => {
        window.location.assign(targetUrl);
      }, 250);
    },
    [router],
  );
  const pendingNavigationSeedRef = React.useRef<{
    optimisticSpace: Space;
    organisationSpaces: Space[];
  } | null>(null);

  React.useEffect(() => {
    if (progress === 100 && !hasNavigatedAfterSuccessRef.current) {
      hasNavigatedAfterSuccessRef.current = true;
      void (async () => {
        const seed = pendingNavigationSeedRef.current;
        const mutationPromises: Promise<unknown>[] = [];

        // Keep the ecosystem graph fresh when the modal closes back to it.
        if (jwt) {
          if (seed) {
            mutationPromises.push(
              mutate(
                [`/api/v1/spaces/${parentSpaceSlug}/organisation`, jwt],
                (current: Space[] = []) => {
                  if (
                    current.some(
                      (space) => space.slug === seed.optimisticSpace.slug,
                    )
                  ) {
                    return current;
                  }
                  return [...current, seed.optimisticSpace];
                },
                { revalidate: true },
              ),
            );
          }
          mutationPromises.push(
            mutate([`/api/v1/spaces/${parentSpaceSlug}/organisation`, jwt]),
          );
        }
        mutationPromises.push(mutate(`/api/v1/spaces/${parentSpaceSlug}`));

        if (seed && spaceSlug) {
          mutationPromises.push(
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
          );
        }

        const mutationResults = await Promise.allSettled(mutationPromises);
        mutationResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(
              '[CreateSubspaceForm] Failed to refresh cache before navigation',
              {
                index,
                error: result.reason,
              },
            );
          }
        });
        if (seed && spaceSlug) {
          const seedFailures = mutationResults.slice(-2);
          seedFailures.forEach((result, index) => {
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
        const targetUrl = resolveSuccessUrl(
          spaceSlug ?? seed?.optimisticSpace.slug,
        );
        closeAfterSuccess(targetUrl);
      })();
    }
  }, [
    closeAfterSuccess,
    jwt,
    mutate,
    parentSpaceSlug,
    progress,
    resolveSuccessUrl,
    spaceSlug,
  ]);

  React.useEffect(() => {
    if (isError) {
      setIsSubmitting(false);
      hasNavigatedAfterSuccessRef.current = false;
      setSubmitBlockError(null);
    }
  }, [isError]);

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
            <Button
              onClick={() => {
                setIsSubmitting(false);
                hasNavigatedAfterSuccessRef.current = false;
                setSubmitBlockError(null);
                reset();
              }}
            >
              {t('reset')}
            </Button>
          </div>
        ) : (
          <div>{currentAction}</div>
        )
      }
    >
      <SpaceForm
        isLoading={isPending || isSubmitting}
        creator={{ name: person?.name, surname: person?.surname }}
        closeUrl={successfulUrl}
        backUrl={backUrl}
        backLabel={t('backToSettings')}
        onSubmit={(values, organisationSpaces) => {
          if (isSubmitting || hasNavigatedAfterSuccessRef.current) {
            return;
          }
          setIsSubmitting(true);
          setSubmitBlockError(null);
          // Subspace creation does not use root-only ecosystem branding fields.
          const {
            ecosystemLogoUrlLight: _ecosystemLogoUrlLight,
            ecosystemLogoUrlDark: _ecosystemLogoUrlDark,
            ...createValues
          } = values;
          if (parentSpaceId === null) {
            // Guard against transient route hydration where the parent space
            // context isn't resolved yet; avoid creating an orphan root space.
            console.warn(
              '[CreateSubspaceForm] Submit blocked: parentSpaceId not yet resolved',
            );
            setSubmitBlockError(t('errorOhSnap'));
            setIsSubmitting(false);
            return;
          }
          const normalizedParentId =
            parentSpaceId ?? createValues.parentId ?? null;
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
      {submitBlockError ? (
        <div className="text-sm text-error-11">{submitBlockError}</div>
      ) : null}
    </SpaceLoadingBackdrop>
  );
};
