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
  compact = false,
}: {
  value: number | null;
  label: string;
  split: string | null;
  isLoading: boolean;
  /** Skeleton a second line while the public/private split is still resolving. */
  reserveSplit?: boolean;
  lang: string;
  index: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col border-border text-left',
        compact
          ? cn(
              'px-3 py-4',
              index % 2 === 1 && 'border-l',
              index >= 2 && 'border-t',
            )
          : cn(
              'items-start py-3',
              'md:items-center md:px-4 md:py-2 md:text-center',
              index % 2 === 0 && 'max-md:pr-4',
              index % 2 === 1 && 'max-md:border-l max-md:pl-4',
              index >= 2 && 'max-md:border-t',
              index > 0 && 'md:border-l',
            ),
      )}
    >
      {compact ? (
        <div className="text-1 uppercase tracking-[0.08em] text-neutral-11">
          {label}
        </div>
      ) : null}
      <div
        className={cn(
          '[font-family:var(--font-family-heading)] font-medium tabular-nums text-foreground',
          compact
            ? 'mt-1.5 text-3 leading-none'
            : 'text-7 tracking-[-0.03em] md:text-8',
        )}
      >
        {isLoading ? (
          <Skeleton loading width={72} height={36} />
        ) : value == null ? (
          '—'
        ) : (
          formatCount(value, lang)
        )}
      </div>
      {compact ? null : (
        <div className="mt-1 text-2 text-muted-foreground">{label}</div>
      )}
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
  tokens,
  compact = false,
}: {
  lang: Locale;
  isLoading: boolean;
  spaces: CensusFigures;
  members: CensusFigures;
  agreements: CensusFigures;
  tokens: CensusFigures | null;
  /** Two-by-two tile for the network side panel. */
  compact?: boolean;
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
      // The token total is already in the server payload. Keep it behind the
      // same settle flag as the directory counts so it does not paint early.
      value: isLoading ? null : tokens?.total ?? null,
      label: t('tokens'),
      split:
        !isLoading && tokens
          ? split(tokens.publicCount, tokens.privateCount)
          : null,
      isLoading,
      reserveSplit: true,
    },
  ];

  return (
    <div
      className={cn('grid w-full grid-cols-2', !compact && 'md:grid-cols-4')}
    >
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
          compact={compact}
        />
      ))}
    </div>
  );
}
