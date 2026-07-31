'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
    <div className="relative min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full overflow-hidden">
      {/* Full-bleed atmospheric plane — cool mist + teal mycelium accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(120% 80% at 10% 0%, oklch(0.92 0.04 185 / 0.55), transparent 55%),
            radial-gradient(90% 70% at 90% 20%, oklch(0.88 0.05 200 / 0.35), transparent 50%),
            linear-gradient(180deg, var(--background-1), var(--background-2) 70%, var(--background-1))
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 40%, oklch(0.58 0.12 176 / 0.25) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, oklch(0.58 0.12 176 / 0.18) 0 1px, transparent 1px)',
          backgroundSize: '48px 48px, 72px 72px',
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full max-w-container-xl flex-col justify-center px-5 py-16 md:px-8 md:py-24">
        <p
          className="mb-4 text-5 font-semibold tracking-[-0.02em] text-accent-11 sm:text-6"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('brand')}
        </p>
        <h1
          className="max-w-[18ch] text-balance text-8 font-semibold tracking-[-0.02em] text-foreground sm:text-9"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('headline')}
        </h1>
        <p className="mt-4 max-w-[36ch] text-3 leading-relaxed text-muted-foreground">
          {t('support')}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="rounded-xl px-6"
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
          <Button
            asChild
            size="lg"
            variant="outline"
            colorVariant="neutral"
            className="rounded-xl px-6"
          >
            <Link href={`/${lang}/network`}>{t('ctaExplore')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
