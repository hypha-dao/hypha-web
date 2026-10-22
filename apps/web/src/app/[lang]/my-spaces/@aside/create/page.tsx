'use client';

import {
  SpaceForm,
  ProposalOverlayShell,
  getDhoPathDefaultLanding,
  type SpaceCapitalSelection,
} from '@hypha-platform/epics';
import { readExchangeCapitalsDraft } from '@hypha-platform/core/client';
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
import { useTranslations } from 'next-intl';

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
      router.push(getDhoPathDefaultLanding(lang as Locale, spaceSlug));
    }
  }, [progress, spaceSlug]);

  const tSpaces = useTranslations('Spaces');
  const tAgreementFlow = useTranslations('AgreementFlow');
  const tCommon = useTranslations('Common');
  const [capitals, setCapitals] = React.useState<SpaceCapitalSelection>({
    seeks: [],
    offers: [],
  });
  const capitalsTouchedRef = React.useRef(false);
  React.useEffect(() => {
    const draft = readExchangeCapitalsDraft();
    if (!capitalsTouchedRef.current && draft) setCapitals(draft);
  }, []);

  const closeUrl = pathname.split('/').slice(0, -1).join('/') || '/';

  return progress !== 100 ? (
    <ProposalOverlayShell>
      <LoadingBackdrop
        fullHeight={true}
        showKeepWindowOpenMessage={true}
        keepWindowOpenMessage={tAgreementFlow('loadingBackdrop.keepWindowOpen')}
        progress={progress}
        isLoading={isPending}
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
          creator={{
            name: person?.name,
            surname: person?.surname,
          }}
          closeUrl={closeUrl}
          backUrl={closeUrl}
          backLabel={tCommon('back')}
          onSubmit={(values) =>
            createSpace({ ...values, exchangeCapitals: capitals })
          }
          capitals={capitals}
          onCapitalsChange={(next) => {
            capitalsTouchedRef.current = true;
            setCapitals(next);
          }}
          isLoading={isLoadingJwt}
          label="create"
          slugIncorrectMessage={tSpaces('slugAlreadyExistsLong')}
        />
      </LoadingBackdrop>
    </ProposalOverlayShell>
  ) : null;
}
