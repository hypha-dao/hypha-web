'use client';

import { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

type CensusFigures = {
  total: number;
  publicCount: number;
  privateCount: number;
};

function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang).format(value);
}

function StatColumn({
  value,
  label,
  split,
  isLoading,
  reserveSplit = false,
  lang,
  index,
}: {
  value: number | null;
  label: string;
  split: string | null;
  isLoading: boolean;
  /** Skeleton a second line while the public/private split is still resolving. */
  reserveSplit?: boolean;
  lang: string;
  index: number;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-start border-border py-3 text-left',
        'md:items-center md:px-4 md:py-1 md:text-center',
        index > 0 && 'max-md:border-t md:border-l',
      )}
    >
      <div className="[font-family:var(--font-family-heading)] text-7 font-medium tabular-nums tracking-[-0.03em] text-foreground md:text-8">
        {isLoading ? (
          <Skeleton loading width={72} height={36} />
        ) : value == null ? (
          '—'
        ) : (
          formatCount(value, lang)
        )}
      </div>
      <div className="mt-1 text-2 text-muted-foreground">{label}</div>
      {isLoading && reserveSplit ? (
        <Skeleton loading width={96} height={12} className="mt-1" />
      ) : split ? (
        <div className="mt-0.5 text-1 text-muted-foreground">{split}</div>
      ) : null}
    </div>
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

  const columns = [
    {
      value: isLoading ? null : spaces.total,
      label: tCommon('Spaces'),
      split: isLoading ? null : split(spaces.publicCount, spaces.privateCount),
      isLoading,
      reserveSplit: true,
    },
    {
      value: isLoading ? null : members.total,
      label: tCommon('Members'),
      split: isLoading
        ? null
        : split(members.publicCount, members.privateCount),
      isLoading,
      reserveSplit: true,
    },
    {
      value: isLoading ? null : agreements.total,
      label: tCommon('Agreements'),
      split: isLoading
        ? null
        : split(agreements.publicCount, agreements.privateCount),
      isLoading,
      reserveSplit: true,
    },
    {
      value: transactions?.total ?? null,
      label: t('transactions'),
      split: null,
      isLoading: false,
      reserveSplit: false,
    },
    {
      value: tokens?.total ?? null,
      label: t('tokens'),
      split: null,
      isLoading: false,
      reserveSplit: false,
    },
  ];

  return (
    <div className="grid w-full grid-cols-1 md:grid-cols-5">
      {columns.map((column, index) => (
        <StatColumn
          key={column.label}
          lang={lang}
          index={index}
          value={column.value}
          label={column.label}
          split={column.split}
          isLoading={column.isLoading}
          reserveSplit={column.reserveSplit}
        />
      ))}
    </div>
  );
}
