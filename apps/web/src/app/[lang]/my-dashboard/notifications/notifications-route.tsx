'use client';

import { MemberHomeNotifications } from '@hypha-platform/epics';
import { useAuthentication } from '@hypha-platform/authentication';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

export function MemberHomeNotificationsRoute({ lang }: { lang: Locale }) {
  const t = useTranslations('MemberHome');
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    login,
  } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { data, isLoading } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to load home');
      return (await response.json()) as MemberIntelligence;
    },
  );

  if (isAuthLoading || isLoadingJwt) {
    return <MemberHomeNotifications lang={lang} items={[]} isLoading />;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1
          className="text-3 font-medium tracking-[-0.03em]"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('signInTitle')}
        </h1>
        <p className="mt-3 text-1 text-neutral-11">{t('signInBody')}</p>
        <Button className="mt-6" type="button" onClick={() => void login?.()}>
          {t('signIn')}
        </Button>
      </div>
    );
  }

  return (
    <MemberHomeNotifications
      lang={lang}
      items={data?.notifications ?? []}
      isLoading={!data && (isLoading || Boolean(jwt))}
    />
  );
}
