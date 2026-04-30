'use client';

import { useConfig } from 'wagmi';
import { SpaceForm } from './create-space-form';
import { useParams, useRouter } from 'next/navigation';
import { useJwt } from '@hypha-platform/core/client';
import { useCreateSpaceOrchestrator } from '@hypha-platform/core/client';
import React from 'react';
import { SpaceLoadingBackdrop } from './space-loading-backdrop';
import { Button } from '@hypha-platform/ui';
import { useMe } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { useTranslations } from 'next-intl';
import { getDhoPathAgreements } from '../../common';

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
        onSubmit={(values) => {
          // Subspace creation does not use root-only ecosystem branding fields.
          const {
            ecosystemLogoUrl: _ecosystemLogoUrl,
            ecosystemLogoUrlLight: _ecosystemLogoUrlLight,
            ecosystemLogoUrlDark: _ecosystemLogoUrlDark,
            ...createValues
          } = values;
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
