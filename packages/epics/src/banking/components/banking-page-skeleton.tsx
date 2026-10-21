'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Wave } from '@hypha-platform/ui';

import { TREASURY_CARD_GRID_CLASS } from '../banking-ui';

function SkeletonCard() {
  return (
    <div
      className="flex min-h-[8.5rem] flex-col gap-3 rounded-lg border border-border bg-card p-4"
      aria-hidden
    >
      <Wave className="h-5 w-28" />
      <Wave className="h-4 w-full" delayMs={40} />
      <Wave className="h-4 w-3/4" delayMs={80} />
    </div>
  );
}

function SkeletonSection({
  titleWidth,
  cardCount,
}: {
  titleWidth: string;
  cardCount: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Wave className={`h-6 ${titleWidth}`} />
          <Wave className="mt-2 h-4 max-w-xl" delayMs={40} />
        </div>
        <Wave className="h-9 w-36" delayMs={80} />
      </div>
      <div className={TREASURY_CARD_GRID_CLASS}>
        {Array.from({ length: cardCount }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </section>
  );
}

export const BankingPageSkeleton: FC = () => {
  const t = useTranslations('BankingTab');

  return (
    <div
      className="flex w-full flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <div className="flex items-center justify-between gap-2">
        <Wave className="h-9 w-52" />
        <Wave className="h-9 w-9" delayMs={40} />
      </div>
      <div className="flex flex-col gap-8">
        <SkeletonSection titleWidth="w-40" cardCount={3} />
        <SkeletonSection titleWidth="w-52" cardCount={2} />
      </div>
    </div>
  );
};
