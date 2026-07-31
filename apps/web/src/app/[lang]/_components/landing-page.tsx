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
      className="relative min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full overflow-hidden text-white"
    >
      {/* Midnight atmosphere — aligned with marketing website, not mycelium teal */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 65% at 50% 22%, var(--landing-navy-mid), var(--landing-navy-deep) 72%),
            radial-gradient(ellipse 55% 40% at 12% 80%, var(--landing-navy-glow), transparent 68%),
            radial-gradient(ellipse 50% 35% at 90% 70%, color-mix(in oklab, var(--landing-accent) 18%, transparent), transparent 65%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle,oklch(1_0_0_/_0.42)_0.5px,transparent_0.5px)] [background-size:32px_32px]"
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-var(--menu-top-height,70px))] w-full max-w-container-xl flex-col justify-center px-5 py-16 md:px-8 md:py-24">
        <p
          className="mb-4 text-5 font-semibold tracking-[-0.02em] text-[var(--landing-accent)] sm:text-6"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('brand')}
        </p>
        <h1
          className="max-w-[18ch] text-balance text-8 font-semibold tracking-[-0.02em] text-white sm:text-9"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('headline')}
        </h1>
        <p className="mt-4 max-w-[36ch] text-3 leading-relaxed text-white/70">
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
            className="rounded-xl border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href={`/${lang}/network`}>{t('ctaExplore')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
