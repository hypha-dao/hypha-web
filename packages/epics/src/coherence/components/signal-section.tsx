'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useSignalsSection } from '../hooks';
import {
  Badge,
  Button,
  SectionFilter,
  SectionLoadMore,
  Separator,
} from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGridContainer } from './signal-grid.container';
import {
  Coherence,
  COHERENCE_TYPE_OPTIONS,
  CoherenceType,
  DirectionType,
} from '@hypha-platform/core/client';
import { PlusIcon, RocketIcon } from '@radix-ui/react-icons';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import { cva } from 'class-variance-authority';
import { cn } from '@hypha-platform/ui-utils';
import React from 'react';
import { useTranslations } from 'next-intl';

type SignalSectionProps = {
  basePath: string;
  signals: Coherence[];
  label?: string;
  hasSearch?: boolean;
  isLoading: boolean;
  firstPageSize?: number;
  pageSize?: number;
  order?: string;
  refresh: () => Promise<void>;
  onSignalClick?: (signal: Coherence) => void;
};

export const SignalSection: FC<SignalSectionProps> = ({
  basePath,
  signals,
  label,
  hasSearch = false,
  isLoading,
  firstPageSize = 3,
  pageSize = 3,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const typeRaw = React.useMemo(() => {
    return searchParams.get('type');
  }, [searchParams]);
  const validTypes = COHERENCE_TYPE_OPTIONS.map((o) => o.type);
  const type = React.useMemo(() => {
    if (!typeRaw) return undefined;
    return validTypes.includes(typeRaw as CoherenceType)
      ? (typeRaw as CoherenceType)
      : undefined;
  }, [typeRaw, validTypes]);
  const chosenSignals = React.useMemo(() => {
    if (!type) {
      return signals;
    }
    const result = signals.filter((signal) => signal.type === type);
    return result;
  }, [signals, type]);
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  } = useSignalsSection({
    signals: chosenSignals,
    firstPageSize,
    pageSize,
  });

  const onTagClick = React.useCallback(
    (type: string) => {
      const params = new URLSearchParams(searchParams);
      if (type === 'all') {
        params.delete('type');
      } else {
        params.set('type', type);
      }
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace],
  );

  /** Type filters — calm chips aligned with modal / overlay surfaces (PR #2160-style soft accent). */
  const multiSelectVariants = cva(
    'm-1 cursor-pointer transition-colors duration-150 ease-out hover:bg-accent-2',
    {
      variants: {
        variant: {
          default:
            'border-neutral-8/70 bg-background/80 text-neutral-11 shadow-none hover:border-accent-8/60 dark:bg-background/40',
          secondary:
            'border-accent-8 bg-accent-3 text-accent-12 shadow-sm hover:bg-accent-4 dark:border-accent-9/40',
          destructive:
            'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
          inverted: 'inverted',
        },
      },
      defaultVariants: {
        variant: 'default',
      },
    },
  );

  const createSignalHref = `/${lang}/dho/${id}/coherence/new-signal`;

  const typeOptions = React.useMemo(() => {
    const typeMap = COHERENCE_TYPE_OPTIONS.reduce((acc, cur) => {
      acc[cur.type] = 0;
      return acc;
    }, {} as { [key: string]: number });
    for (const signal of signals) {
      const count = typeMap[signal.type] || 0;
      typeMap[signal.type] = count + 1;
    }
    const coherenceTypes = COHERENCE_TYPE_OPTIONS.map((option) => ({
      label: t(
        `types.${option.type}` as
          | 'types.Opportunity'
          | 'types.Risk'
          | 'types.Tension'
          | 'types.Insight'
          | 'types.Trend'
          | 'types.Proposal',
      ),
      value: option.type,
      count: typeMap[option.type],
    }));
    const typeOptions = [
      { label: t('all'), value: 'all', count: signals.length },
      ...coherenceTypes,
    ];
    return typeOptions;
  }, [signals, t]);

  return (
    <div className="flex w-full flex-col gap-5">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder={t('searchSignals')}
        onChangeSearch={onUpdateSearch}
        inlineLabel={true}
      >
        <div className="flex flex-row gap-2">
          <Button variant="ghost" colorVariant="accent" disabled={true}>
            <RocketIcon />
            {t('improve')}
          </Button>
          <Link href={createSignalHref}>
            <Button
              variant="default"
              colorVariant="accent"
              disabled={isLoading}
            >
              <PlusIcon />
              {t('newSignal')}
            </Button>
          </Link>
        </div>
      </SectionFilter>
      <div className="flex flex-wrap justify-start gap-x-2 gap-y-2">
        {typeOptions.map((typeOption) => (
          <Badge
            key={typeOption.value}
            variant="outline"
            colorVariant={
              typeRaw === typeOption.value ||
              (typeOption.value === 'all' && typeRaw === null)
                ? 'accent'
                : 'neutral'
            }
            className={cn(
              'animate-none',
              multiSelectVariants({
                variant:
                  typeRaw === typeOption.value ||
                  (typeOption.value === 'all' && typeRaw === null)
                    ? 'secondary'
                    : 'default',
              }),
            )}
            onClick={() => onTagClick(typeOption.value)}
          >
            <span className="tabular-nums">{typeOption.label}</span>{' '}
            <span className="tabular-nums text-muted-foreground">
              {typeOption.count}
            </span>
          </Badge>
        ))}
      </div>
      <Separator className="bg-border/70" />

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : (
        <div className="w-full space-y-2">
          {Array.from({ length: pages }).map((_, index) => (
            <SignalGridContainer
              key={`signal-container-${index}`}
              basePath={basePath}
              pagination={{
                page: index + 1,
                firstPageSize,
                pageSize,
                searchTerm,
                order: [
                  {
                    dir: DirectionType.DESC,
                    name: 'id',
                  },
                ],
              }}
              signals={filteredSignals}
              refresh={refresh}
              onSignalClick={onSignalClick}
            />
          ))}
        </div>
      )}
      {pagination?.totalPages === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={pagination?.totalPages === pages}
          isLoading={isLoading}
        >
          <Text className="line-clamp-3 max-w-md text-center text-sm leading-snug">
            {pagination?.totalPages === pages ? t('noMore') : t('loadMore')}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
