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
}) => {
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replace } = useRouter();
  const typeRaw = React.useMemo(() => {
    return searchParams.get('type');
  }, [searchParams]);
  const type = React.useMemo(() => {
    return typeRaw ? (typeRaw as CoherenceType) : undefined;
  }, [typeRaw]);
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
    [searchParams, pathname],
  );

  const multiSelectVariants = cva(
    'm-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300',
    {
      variants: {
        variant: {
          default:
            'border-foreground/10 text-foreground text-neutral-500 bg-card hover:bg-card/80',
          secondary:
            'border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80',
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
      label: option.title,
      value: option.type,
      count: typeMap[option.type],
    }));
    const typeOptions = [
      { label: 'All', value: 'all', count: signals.length },
      ...coherenceTypes,
    ];
    return typeOptions;
  }, [signals]);

  return (
    <div className="flex flex-col justify-around items-center gap-4">
      <SectionFilter
        count={pagination?.total || 0}
        label={label || ''}
        hasSearch={hasSearch}
        searchPlaceholder="Search signals..."
        onChangeSearch={onUpdateSearch}
        inlineLabel={true}
      >
        <div className="flex flex-row gap-2">
          <Button variant="ghost" colorVariant="accent" disabled={true}>
            <RocketIcon />
            Improve
          </Button>
          <Link href={createSignalHref}>
            <Button
              variant="default"
              colorVariant="accent"
              disabled={isLoading}
            >
              <PlusIcon />
              New Signal
            </Button>
          </Link>
        </div>
      </SectionFilter>
      <div className="flex justify-center space-x-2 space-y-2 flex-wrap">
        {typeOptions.map((typeOption) => (
          <Badge
            key={typeOption.value}
            className={cn(
              multiSelectVariants({
                variant:
                  typeRaw === typeOption.value ||
                  (typeOption.value === 'all' && typeRaw === null)
                    ? 'secondary'
                    : 'default',
              }),
            )}
            style={{ cursor: 'pointer', animationDuration: '0s' }}
            onClick={() => onTagClick(typeOption.value)}
          >
            {typeOption.label} {typeOption.count}
          </Badge>
        ))}
      </div>
      <Separator />

      {pagination?.totalPages === 0 ? (
        <Empty>
          <p>List is empty</p>
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
          <Text>
            {pagination?.totalPages === pages ? 'No more' : 'Load more'}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
