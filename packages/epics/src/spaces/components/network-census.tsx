'use client';

import { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type CensusFigures = {
  total: number;
  publicCount: number;
  privateCount: number;
};

function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang).format(value);
}

function StatCard({
  value,
  label,
  split,
  isLoading,
  reserveSplit = false,
  lang,
}: {
  value: number | null;
  label: string;
  split: string | null;
  isLoading: boolean;
  /** Skeleton a second line while the public/private split is still resolving. */
  reserveSplit?: boolean;
  lang: string;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col border border-border bg-background-2 px-4 py-3.5 dark:bg-background-5">
      <div className="[font-family:var(--font-family-heading)] text-7 font-medium tabular-nums tracking-[-0.03em] text-foreground">
        {isLoading ? (
          <Skeleton loading width={72} height={28} />
        ) : value == null ? (
          '—'
        ) : (
          formatCount(value, lang)
        )}
      </div>
      <div className="mt-1 text-1 text-muted-foreground">{label}</div>
      {isLoading && reserveSplit ? (
        <Skeleton loading width={96} height={12} className="mt-1" />
      ) : split ? (
        <div className="mt-1 text-1 text-muted-foreground">{split}</div>
      ) : null}
    </article>
  );
}

export function NetworkCensus({
  lang,
  isLoading,
  spaces,
  members,
  agreements,
  transactions,
  tokens,
}: {
  lang: Locale;
  isLoading: boolean;
  spaces: CensusFigures;
  members: CensusFigures;
  agreements: CensusFigures;
  transactions: CensusFigures | null;
  tokens: CensusFigures | null;
}) {
  const t = useTranslations('Network');
  const tCommon = useTranslations('Common');

  const split = (directory: number, privateCount: number) =>
    privateCount > 0
      ? t('directoryPrivateSplit', {
          directory,
          private: privateCount,
        })
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        lang={lang}
        value={isLoading ? null : spaces.total}
        label={tCommon('Spaces')}
        split={
          isLoading ? null : split(spaces.publicCount, spaces.privateCount)
        }
        isLoading={isLoading}
        reserveSplit
      />
      <StatCard
        lang={lang}
        value={isLoading ? null : members.total}
        label={tCommon('Members')}
        split={
          isLoading ? null : split(members.publicCount, members.privateCount)
        }
        isLoading={isLoading}
        reserveSplit
      />
      <StatCard
        lang={lang}
        value={isLoading ? null : agreements.total}
        label={tCommon('Agreements')}
        split={
          isLoading
            ? null
            : split(agreements.publicCount, agreements.privateCount)
        }
        isLoading={isLoading}
        reserveSplit
      />
      <StatCard
        lang={lang}
        value={transactions?.total ?? null}
        label={t('transactions')}
        split={null}
        isLoading={false}
      />
      <StatCard
        lang={lang}
        value={tokens?.total ?? null}
        label={t('tokens')}
        split={null}
        isLoading={false}
      />
    </div>
  );
}
