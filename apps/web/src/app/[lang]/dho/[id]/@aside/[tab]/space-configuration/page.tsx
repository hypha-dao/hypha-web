'use client';

import {
  Space,
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
} from '@hypha-platform/epics';
import { useParams, usePathname } from 'next/navigation';
import React from 'react';
import { LoadingBackdrop } from '@hypha-platform/ui/server';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { PATH_SELECT_SETTINGS_ACTION } from '@web/app/constants';
import { useTranslations } from 'next-intl';

export default function SpaceConfiguration() {
  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
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
      router.push(getDhoPathAgreements(lang as Locale, newSpaceSlug));
    }
  }, [progress, isPending, newSpaceSlug, lang]);

  const isBusy = isLoadingJwt || isLoadingSpace || isPending;

  const pathname = usePathname();
  const closeUrl = pathname.replace(/\/space-configuration$/, '');

  const normalizeNullableEcosystemLogoUrl = (
    value: string | null | undefined,
  ): string | undefined => value ?? undefined;
  const normalizeNullableThemeLogoUrl = (
    value: string | null | undefined,
  ): string | undefined => value ?? undefined;
  const normalizeNullableFileUrl = (
    value: string | null | undefined,
  ): string | undefined => value ?? undefined;

  const submitForm = React.useCallback(
    async (
      updatedSpace: SchemaCreateSpaceForm,
      organisationSpaces?: Space[],
    ) => {
      try {
        if (space) {
          const wasArchived = space.flags?.includes('archived') ?? false;
          const willBeArchived =
            updatedSpace.flags?.includes('archived') ?? false;
          const normalizedUpdatedSpace = willBeArchived
            ? { ...updatedSpace, parentId: null }
            : updatedSpace;

          if (!wasArchived && willBeArchived) {
            const archivedSpaceParentId = space.parentId ?? null;
            const childSpaces =
              organisationSpaces?.filter(
                (orgSpace) => orgSpace.parentId === space.id,
              ) ?? [];

            for (const childSpace of childSpaces) {
              const {
                id,
                description,
                address,
                web3SpaceId,
                slug,
                ...updates
              } = childSpace;

              await updateSpace({
                id,
                data: {
                  ...updates,
                  slug,
                  parentId: archivedSpaceParentId,
                  description: description as string | undefined,
                  address: address as string | undefined,
                  web3SpaceId: web3SpaceId as number | undefined,
                  logoUrl: normalizeNullableFileUrl(updates.logoUrl),
                  leadImage: normalizeNullableFileUrl(updates.leadImage),
                  ecosystemLogoUrl: normalizeNullableEcosystemLogoUrl(
                    updates.ecosystemLogoUrl,
                  ),
                  ecosystemLogoUrlLight: normalizeNullableThemeLogoUrl(
                    updates.ecosystemLogoUrlLight,
                  ),
                  ecosystemLogoUrlDark: normalizeNullableThemeLogoUrl(
                    updates.ecosystemLogoUrlDark,
                  ),
                },
              });
            }
          }

          if (!space.parentId && normalizedUpdatedSpace.parentId) {
            const foundInnerSpace = organisationSpaces?.find(
              (inner) => inner.id === normalizedUpdatedSpace.parentId,
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
                  logoUrl: normalizeNullableFileUrl(updates.logoUrl),
                  leadImage: normalizeNullableFileUrl(updates.leadImage),
                  ecosystemLogoUrl: normalizeNullableEcosystemLogoUrl(
                    updates.ecosystemLogoUrl,
                  ),
                  ecosystemLogoUrlLight: normalizeNullableThemeLogoUrl(
                    updates.ecosystemLogoUrlLight,
                  ),
                  ecosystemLogoUrlDark: normalizeNullableThemeLogoUrl(
                    updates.ecosystemLogoUrlDark,
                  ),
                },
              });
            }
          }
          setNewSpaceSlug(normalizedUpdatedSpace.slug || '');
          await updateSpace({
            id: space.id,
            data: normalizedUpdatedSpace,
          });
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [space, updateSpace],
  );

  return (
    <ProposalOverlayShell>
      <LoadingBackdrop
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
        fullHeight={true}
        progress={progress}
        isLoading={isBusy}
        message={
          isError ? (
            <div className="flex flex-col">
              <div>{tSpaces('errorOhSnap')}</div>
              <Button onClick={reset}>{tSpaces('reset')}</Button>
            </div>
          ) : (
            <div>{currentAction}</div>
          )
        }
      >
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
          values={{
            ...space,
            title: space?.title || '',
            description: space?.description || '',
            slug: space?.slug || '',
            logoUrl: space?.logoUrl || '',
            ecosystemLogoUrl: space?.ecosystemLogoUrl ?? undefined,
            ecosystemLogoUrlLight: space?.ecosystemLogoUrlLight ?? undefined,
            ecosystemLogoUrlDark: space?.ecosystemLogoUrlDark ?? undefined,
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
    </ProposalOverlayShell>
  );
}
