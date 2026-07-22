'use client';

import {
  type Space,
  useJwt,
  useMe,
  useSpaceBySlug,
  useUpdateSpaceOrchestrator,
} from '@hypha-platform/core/client';
import {
  getDhoPathAgreements,
  SchemaCreateSpaceForm,
  ProposalOverlayShell,
  SpaceForm,
  getNetworkMapReturnPath,
  isNetworkAddLocationReturn,
  getSignalWorkflowReturnPath,
  isSignalWorkflowConfigurationReturn,
} from '@hypha-platform/epics';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { useTranslations } from 'next-intl';
import { mutate } from 'swr';

type SpaceConfigurationClientProps = {
  enableNetworkMap: boolean;
};

function isSpaceRecord(value: unknown): value is Space {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'number' &&
    'slug' in value &&
    typeof (value as { slug: unknown }).slug === 'string'
  );
}

async function refreshSpaceCaches({
  previousSlug,
  nextSlug,
  updatedSpace,
}: {
  previousSlug: string;
  nextSlug: string;
  updatedSpace: Space | null;
}) {
  const refreshKeys = new Set<string>([
    `/api/v1/spaces/${previousSlug}`,
    `/api/v1/spaces/${nextSlug}`,
    '/api/v1/spaces?parentOnly=false',
    `/api/v1/spaces?slugs=${nextSlug}&parentOnly=false`,
  ]);

  const results = await Promise.allSettled(
    [...refreshKeys].map((key) => {
      if (
        updatedSpace &&
        (key === `/api/v1/spaces/${previousSlug}` ||
          key === `/api/v1/spaces/${nextSlug}`)
      ) {
        return mutate(key, updatedSpace, { revalidate: true });
      }
      return mutate(key);
    }),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        '[SpaceConfiguration] Failed to refresh space cache before navigation',
        { key: [...refreshKeys][index], error: result.reason },
      );
    }
  });
}

export function SpaceConfigurationClient({
  enableNetworkMap,
}: SpaceConfigurationClientProps) {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCoherence = useTranslations('CoherenceTab');
  const { person } = useMe();
  const { id: spaceSlug, lang } = useParams<{ id: string; lang: Locale }>();
  const { space, isLoading: isLoadingSpace } = useSpaceBySlug(spaceSlug);
  const { jwt, isLoadingJwt } = useJwt();
  const router = useRouter();
  const {
    updateSpaceConfiguration,
    currentAction,
    isError,
    errors,
    isPending,
    progress,
    reset,
  } = useUpdateSpaceOrchestrator({ authToken: jwt });
  const searchParams = useSearchParams();
  const returnToNetworkMap = React.useMemo(
    () => isNetworkAddLocationReturn(searchParams),
    [searchParams],
  );
  const returnToSignals = React.useMemo(
    () => isSignalWorkflowConfigurationReturn(searchParams),
    [searchParams],
  );
  const [isRefreshingCaches, setIsRefreshingCaches] = React.useState(false);

  const isBusy =
    isLoadingJwt ||
    isLoadingSpace ||
    isPending ||
    isRefreshingCaches ||
    isError;

  const pathname = usePathname();
  const closeUrl = React.useMemo(() => {
    const segment = '/space-configuration';
    if (pathname.endsWith(segment)) {
      return pathname.slice(0, -segment.length) || '/';
    }
    if (pathname.endsWith(`${segment}/`)) {
      return pathname.slice(0, -(segment.length + 1)) || '/';
    }
    if (pathname.includes(`${segment}/`)) {
      return pathname.replace(`${segment}/`, '/');
    }
    return pathname.replace(segment, '') || '/';
  }, [pathname]);

  const resolvedCloseUrl = React.useMemo(() => {
    if (returnToSignals) {
      return getSignalWorkflowReturnPath(
        lang as Locale,
        spaceSlug,
        searchParams,
      );
    }
    return closeUrl;
  }, [closeUrl, lang, returnToSignals, searchParams, spaceSlug]);

  const resolvedBackUrl = React.useMemo(() => {
    if (returnToSignals) {
      return getSignalWorkflowReturnPath(
        lang as Locale,
        spaceSlug,
        searchParams,
      );
    }
    return `${closeUrl}${PATH_SELECT_SETTINGS_ACTION}`;
  }, [closeUrl, lang, returnToSignals, searchParams, spaceSlug]);

  const resolvedBackLabel = returnToSignals
    ? tCoherence('backToCoherence')
    : tSpaces('backToSettings');

  const formValues = React.useMemo(():
    | Partial<SchemaCreateSpaceForm>
    | undefined => {
    if (!space) {
      return undefined;
    }

    return {
      ...space,
      title: space.title || '',
      description: space.description || '',
      slug: space.slug || '',
      logoUrl: space.logoUrl || '',
      ecosystemLogoUrlLight: space.ecosystemLogoUrlLight ?? undefined,
      ecosystemLogoUrlDark: space.ecosystemLogoUrlDark ?? undefined,
      leadImage: space.leadImage || '',
      categories: space.categories || [],
      links: space.links || [],
      web3SpaceId: space.web3SpaceId || undefined,
      parentId: space.parentId || null,
      address: space.address || '',
      flags: space.flags ?? [],
      latitude: space.latitude ?? null,
      longitude: space.longitude ?? null,
      locationLabel: space.locationLabel ?? null,
      locationSource: space.locationSource ?? null,
    };
  }, [space]);

  const submitForm = React.useCallback(
    async (updatedSpace: SchemaCreateSpaceForm) => {
      if (!space) {
        return;
      }

      try {
        const willBeArchived =
          updatedSpace.flags?.includes('archived') ?? false;
        const normalizedUpdatedSpace = willBeArchived
          ? { ...updatedSpace, parentId: null }
          : updatedSpace;
        const nextSlug = normalizedUpdatedSpace.slug || space.slug;

        const result = await updateSpaceConfiguration({
          id: space.id,
          data: normalizedUpdatedSpace,
        });

        setIsRefreshingCaches(true);
        const savedSpace = isSpaceRecord(result) ? result : null;
        await refreshSpaceCaches({
          previousSlug: spaceSlug,
          nextSlug,
          updatedSpace: savedSpace,
        });
        // Banner/logo in the DHO layout come from RSC props — refresh so they update live.
        router.refresh();

        if (returnToNetworkMap) {
          router.push(getNetworkMapReturnPath(lang as Locale));
          return;
        }
        if (returnToSignals) {
          router.push(
            getSignalWorkflowReturnPath(lang as Locale, nextSlug, searchParams),
          );
          return;
        }
        router.push(getDhoPathAgreements(lang as Locale, nextSlug));
      } catch (e) {
        console.warn(e);
        setIsRefreshingCaches(false);
      }
    },
    [
      lang,
      returnToNetworkMap,
      returnToSignals,
      router,
      searchParams,
      space,
      spaceSlug,
      updateSpaceConfiguration,
    ],
  );

  return (
    <ProposalOverlayShell>
      <LoadingBackdrop
        fullHeight={true}
        progress={progress}
        isLoading={isBusy}
        message={
          isError ? (
            <div className="flex flex-col gap-3">
              <div>{tSpaces('errorOhSnap')}</div>
              {errors.length > 0 ? (
                <div className="text-sm text-neutral-10">
                  {errors.map((error, index) => (
                    <p key={index}>
                      {error instanceof Error ? error.message : String(error)}
                    </p>
                  ))}
                </div>
              ) : null}
              <Button onClick={reset}>{tSpaces('reset')}</Button>
            </div>
          ) : (
            <div>
              {isPending || isRefreshingCaches
                ? tAgreementFlow('spaceConfiguration.updating')
                : currentAction}
            </div>
          )
        }
      >
        {formValues && space ? (
          <SpaceForm
            submitLabel={tAgreementFlow('spaceConfiguration.update')}
            submitLoadingLabel={tAgreementFlow('spaceConfiguration.updating')}
            isLoading={isBusy}
            closeUrl={resolvedCloseUrl}
            backUrl={resolvedBackUrl}
            backLabel={resolvedBackLabel}
            creator={{
              name: person?.name,
              surname: person?.surname,
            }}
            onSubmit={submitForm}
            slugIncorrectMessage={tSpaces('slugAlreadyExistsLong')}
            values={formValues}
            label="configure"
            enableNetworkMap={enableNetworkMap}
            initialParentSpaceId={space.parentId ?? null}
            spaceId={space.id}
            spaceSlug={spaceSlug}
          />
        ) : (
          <div aria-hidden="true" className="min-h-px" />
        )}
      </LoadingBackdrop>
    </ProposalOverlayShell>
  );
}
