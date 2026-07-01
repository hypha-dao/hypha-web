'use client';

import {
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

export function SpaceConfigurationClient({
  enableNetworkMap,
}: SpaceConfigurationClientProps) {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
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
  const [newSpaceSlug, setNewSpaceSlug] = React.useState(spaceSlug);
  const searchParams = useSearchParams();
  const returnToNetworkMap = React.useMemo(
    () => isNetworkAddLocationReturn(searchParams),
    [searchParams],
  );

  React.useEffect(() => {
    if (progress === 100 && !isPending && newSpaceSlug) {
      if (returnToNetworkMap) {
        router.push(getNetworkMapReturnPath(lang as Locale));
        return;
      }
      router.push(getDhoPathAgreements(lang as Locale, newSpaceSlug));
    }
  }, [progress, isPending, newSpaceSlug, lang, router, returnToNetworkMap]);

  const isBusy = isLoadingJwt || isLoadingSpace || isPending;

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

        setNewSpaceSlug(normalizedUpdatedSpace.slug || '');
        await updateSpaceConfiguration({
          id: space.id,
          data: normalizedUpdatedSpace,
        });

        const mutateRequests = [mutate('/api/v1/spaces?parentOnly=false')];
        if (normalizedUpdatedSpace.slug) {
          mutateRequests.push(
            mutate(
              `/api/v1/spaces?slugs=${normalizedUpdatedSpace.slug}&parentOnly=false`,
            ),
          );
        }
        await Promise.all(mutateRequests);
      } catch (e) {
        console.warn(e);
      }
    },
    [space, updateSpaceConfiguration],
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
              {isPending
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
            closeUrl={closeUrl}
            backUrl={`${closeUrl}${PATH_SELECT_SETTINGS_ACTION}`}
            backLabel={tSpaces('backToSettings')}
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
