'use client';

import {
  MemberHome,
  resolveMemberHomePhase,
  type MemberHomeRecord,
  type SignupOrientation,
} from '@hypha-platform/epics';
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

  const personRecord: MemberHomeRecord =
    person === null ? 'none' : person ? 'present' : 'missing';
  const homeRecord: MemberHomeRecord =
    data === null ? 'none' : data ? 'present' : 'missing';
  // Privy `authenticated` (what the header uses) can be true before a Bearer
  // token exists. Only a GET /me 404 is "no profile". A 500 stays signed in.
  const phase = resolveMemberHomePhase({
    authLoading: isAuthLoading,
    jwtLoading: isLoadingJwt,
    authenticated: isAuthenticated,
    personLoading: isPersonLoading,
    person: personRecord,
    meError: Boolean(meError),
    homeLoading: isLoadingHome,
    home: homeRecord,
    homeError: Boolean(error),
  });

  useEffect(() => {
    if (phase !== 'signup') return;
    router.replace(`/${lang}/profile/signup`);
  }, [phase, lang, router]);

  if (phase === 'loading' || phase === 'signup') {
    return (
      <p className="px-5 py-16 text-center text-2 text-neutral-11">
        {t('loading')}
      </p>
    );
  }

  if (phase === 'signed-out') {
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

  if (phase === 'profile-unavailable' || phase === 'home-unavailable') {
    const name = person?.name?.trim() || person?.nickname?.trim();
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="text-2 text-neutral-11">
          {phase === 'profile-unavailable'
            ? t('profileUnavailable')
            : name
            ? t('errorNamed', { name })
            : t('error')}
        </p>
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
