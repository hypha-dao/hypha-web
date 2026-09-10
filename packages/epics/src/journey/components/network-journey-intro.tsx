'use client';

import { useTranslations } from 'next-intl';
import { JourneyMark } from './journey-mark';

export function NetworkJourneyIntro() {
  const t = useTranslations('Journey');

  return (
    <header className="craft-page-header gap-3">
      <div className="flex items-center gap-3">
        <JourneyMark kind="pulse" />
        <p className="text-1 font-medium uppercase tracking-[0.08em] text-accent-11">
          {t('networkKicker')}
        </p>
      </div>
      <h1 className="craft-page-title max-w-[20ch] [font-family:var(--font-family-heading)] text-7 font-semibold tracking-[-0.02em]">
        {t('networkPageTitle')}
      </h1>
      <p className="max-w-[46ch] text-3 leading-relaxed text-muted-foreground">
        {t('networkPageLead')}
      </p>
    </header>
  );
}
