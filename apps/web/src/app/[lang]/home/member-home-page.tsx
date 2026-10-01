'use client';

import { MemberHome, type SignupOrientation } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useJwt,
  useMe,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

export function MemberHomePage({ lang }: { lang: Locale }) {
  const t = useTranslations('MemberHome');
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    login,
  } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { person, isLoading: isPersonLoading, meError, revalidate } = useMe();
  const [isSavingOrientation, setIsSavingOrientation] = useState(false);
  const [orientationError, setOrientationError] = useState<string | null>(null);

  const {
    data,
    error,
    isLoading: isLoadingHome,
    mutate,
  } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error('Failed to load home');
      }
      return (await response.json()) as MemberIntelligence;
    },
  );

  const chooseOrientation = useCallback(
    async (primaryOrientation: SignupOrientation) => {
      if (!jwt) return;
      setIsSavingOrientation(true);
      setOrientationError(null);
      try {
        const response = await fetch('/api/v1/people/me/orientation', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ primaryOrientation }),
        });
        if (!response.ok) {
          setOrientationError(t('orientationSaveError'));
          return;
        }
        await mutate();
      } catch {
        setOrientationError(t('orientationSaveError'));
      } finally {
        setIsSavingOrientation(false);
      }
    },
    [jwt, mutate, t],
  );

  // Privy `authenticated` (what the header uses) can be true before
  // `getAccessToken()` returns a Bearer token. A null SWR key is not a load,
  // so treating `!data` as signed-out stuck Home on "Sign in" while the menu
  // still showed the wallet.
  const authUnresolved = isAuthLoading || isLoadingJwt;
  const profileSettled =
    isAuthenticated && !authUnresolved && !isPersonLoading && !meError;
  // GET /me 404, or intelligence 404 with no person row: signup is the welcome
  // flow. A loaded profile must stay on Home (builders reach /onboarding from
  // there), not get the signed-out screen.
  const noProfile =
    profileSettled &&
    (person === null || (data === null && person === undefined));

  useEffect(() => {
    if (!noProfile) return;
    router.replace(`/${lang}/profile/signup`);
  }, [noProfile, lang, router]);

  const waitingForHome =
    isAuthenticated &&
    !meError &&
    !error &&
    person !== null &&
    person !== undefined &&
    (isLoadingHome || data === undefined);

  if (
    authUnresolved ||
    noProfile ||
    (isAuthenticated && isPersonLoading) ||
    waitingForHome
  ) {
    return (
      <p className="px-5 py-16 text-center text-2 text-neutral-11">
        {t('loading')}
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1
          className="text-7 font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('signInTitle')}
        </h1>
        <p className="mt-3 text-2 text-neutral-11">{t('signInBody')}</p>
        <Button className="mt-6" type="button" onClick={() => void login?.()}>
          {t('signIn')}
        </Button>
      </div>
    );
  }

  if (meError || error || (data === null && person)) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="text-2 text-neutral-11">{t('error')}</p>
        <Button
          className="mt-4"
          type="button"
          onClick={() => {
            void revalidate();
            void mutate();
          }}
        >
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="px-5 py-16 text-center text-2 text-neutral-11">
        {t('loading')}
      </p>
    );
  }

  return (
    <MemberHome
      lang={lang}
      intelligence={data}
      isSavingOrientation={isSavingOrientation}
      orientationError={orientationError}
      onChooseOrientation={(orientation) => {
        void chooseOrientation(orientation);
      }}
    />
  );
}
