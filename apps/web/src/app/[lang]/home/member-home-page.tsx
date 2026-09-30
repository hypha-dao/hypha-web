'use client';

import { MemberHome, type SignupOrientation } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

export function MemberHomePage({ lang }: { lang: Locale }) {
  const t = useTranslations('MemberHome');
  const { isAuthenticated, isLoading, login } = useAuthentication();
  const { jwt } = useJwt();
  const [isSavingOrientation, setIsSavingOrientation] = useState(false);

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
      try {
        const response = await fetch('/api/v1/people/me/orientation', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ primaryOrientation }),
        });
        if (!response.ok) return;
        await mutate();
      } finally {
        setIsSavingOrientation(false);
      }
    },
    [jwt, mutate],
  );

  if (isLoading || (isAuthenticated && isLoadingHome && !data)) {
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

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="text-2 text-neutral-11">{t('error')}</p>
        <Button className="mt-4" type="button" onClick={() => void mutate()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1
          className="text-7 font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('signInTitle')}
        </h1>
        <p className="mt-3 text-2 text-neutral-11">{t('signInBody')}</p>
        <Button asChild className="mt-6">
          <Link href={`/${lang}/profile/signup`}>{t('signIn')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <MemberHome
      lang={lang}
      intelligence={data}
      isSavingOrientation={isSavingOrientation}
      onChooseOrientation={(orientation) => {
        void chooseOrientation(orientation);
      }}
    />
  );
}
