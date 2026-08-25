'use client';

import { useTranslations } from 'next-intl';

export function NetworkJourneyIntro() {
  const t = useTranslations('Journey');

  return (
    <header className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 pb-2 pt-6 text-center">
      <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
        {t('networkKicker')}
      </p>
      <h1 className="[font-family:var(--font-family-heading)] text-7 font-semibold tracking-[-0.02em]">
        {t('networkPageTitle')}
      </h1>
      <p className="max-w-[44ch] text-3 leading-relaxed text-muted-foreground">
        {t('networkPageLead')}
      </p>
    </header>
  );
}
