'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useSignalsSection } from '../hooks';
import {
  Button,
  SectionFilter,
  SectionLoadMore,
  Skeleton,
} from '@hypha-platform/ui';
import { Empty } from '../../common';
import { SignalGridContainer } from './signal-grid.container';
import { Coherence, DirectionType } from '@hypha-platform/core/client';
import { PlusIcon } from '@radix-ui/react-icons';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
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
  firstPageSize = 6,
  pageSize = 50,
  refresh,
  onSignalClick,
}) => {
  const t = useTranslations('CoherenceTab');
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const {
    pages,
    loadMore,
    pagination,
    onUpdateSearch,
    searchTerm,
    filteredSignals,
  } = useSignalsSection({
    signals,
    firstPageSize,
    pageSize,
  });

  const createSignalHref = `/${lang}/dho/${id}/coherence/new-signal`;

  /** Match `SignalGrid`: 1 col mobile, 3 cols sm+; two full rows while fetching. */
  const initialSkeletonCount = Math.max(6, firstPageSize);

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

      {isLoading && filteredSignals.length === 0 ? (
        <div
          className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          aria-busy="true"
          aria-label={t('signals')}
        >
          {Array.from({ length: initialSkeletonCount }).map((_, i) => (
            <div
              key={`signal-skeleton-${i}`}
              className="flex min-h-[220px] flex-col gap-3 rounded-2xl border border-border/50 bg-card/40 p-4"
            >
              <Skeleton className="h-5 w-[60%]" loading={true} height="20px" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24" loading={true} height="24px" />
                <Skeleton className="h-6 w-20" loading={true} height="24px" />
              </div>
              <Skeleton className="h-4 w-28" loading={true} height="16px" />
              <Skeleton className="mt-auto h-24 w-full" loading={true} />
              <Skeleton className="h-10 w-full" loading={true} height="40px" />
            </div>
          ))}
        </div>
      ) : pagination?.totalPages === 0 ? (
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
              isLoading={isLoading}
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
