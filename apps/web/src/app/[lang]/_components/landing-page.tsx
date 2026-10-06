'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import '../_shared/landing-marketing.css';

export function LandingPage({ lang }: { lang: Locale }) {
  const t = useTranslations('Landing');
  const { isAuthenticated, isLoading, login } = useAuthentication();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(`/${lang}/my-spaces`);
    }
  }, [isLoading, isAuthenticated, lang, router]);

  return (
    <div
      data-landing-marketing
      className="min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full"
    >
      <div className="mx-auto flex min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full max-w-container-xl flex-col items-center justify-center px-5 py-16 text-center md:px-8 md:py-24">
        <p
          className="mb-4 text-5 font-medium tracking-[-0.03em] sm:text-6"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('brand')}
        </p>
        <h1
          className="max-w-[16ch] text-balance text-8 font-medium tracking-[-0.03em] sm:text-9"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('headline')}
        </h1>
        <p className="mt-4 max-w-[42ch] text-3 leading-relaxed text-current/70">
          {t('support')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={() => {
              if (isAuthenticated) {
                router.push(`/${lang}/my-spaces`);
                return;
              }
              void login?.();
            }}
          >
            {t('ctaEnter')}
          </Button>
          <Button asChild size="lg" variant="outline" colorVariant="neutral">
            <Link href={`/${lang}/network`}>{t('ctaExplore')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
