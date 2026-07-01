'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';

import { TREASURY_CARD_GRID_CLASS } from '../banking-ui';

function SkeletonCard() {
  return (
    <div
      className="flex min-h-[8.5rem] flex-col gap-3 rounded-lg border border-border bg-card p-4"
      aria-hidden
    >
      <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
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
          <div
            className={`h-6 animate-pulse rounded-md bg-muted ${titleWidth}`}
            aria-hidden
          />
          <div
            className="mt-2 h-4 max-w-xl animate-pulse rounded-md bg-muted"
            aria-hidden
          />
        </div>
        <div
          className="h-9 w-36 animate-pulse rounded-md bg-muted"
          aria-hidden
        />
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
  const tAccounts = useTranslations('BankingTab.sections.accounts');
  const tTransfers = useTranslations('BankingTab.sections.transfers');

  return (
    <div
      className="flex w-full flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label={`${tAccounts('title')}, ${tTransfers('title')}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="h-9 w-52 animate-pulse rounded-md bg-muted"
          aria-hidden
        />
        <div
          className="h-9 w-9 animate-pulse rounded-md bg-muted"
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-8">
        <SkeletonSection titleWidth="w-40" cardCount={3} />
        <SkeletonSection titleWidth="w-52" cardCount={2} />
      </div>
    </div>
  );
};
