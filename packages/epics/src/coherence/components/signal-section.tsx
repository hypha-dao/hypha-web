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
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import {
  DhoTabListStack,
  DhoTabSection,
  DhoTabToolbarStack,
} from '../../common';

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

  const createLabel = t('newSignal');

  return (
    <DhoTabSection>
      <DhoTabToolbarStack>
        <SectionFilter
          count={pagination?.total || 0}
          label={label || ''}
          hasSearch={hasSearch}
          searchPlaceholder={t('searchSignals')}
          onChangeSearch={onUpdateSearch}
          inlineLabel={true}
          className="min-w-0 flex-wrap justify-end gap-2 sm:flex-nowrap sm:justify-end"
        >
          <Button
            asChild
            size="icon"
            variant="outline"
            colorVariant="accent"
            disabled={isLoading}
          >
            <Link
              href={createSignalHref}
              scroll={false}
              title={createLabel}
              aria-label={createLabel}
              className={cn(isLoading && 'pointer-events-none')}
            >
              <Plus
                className="h-[1.125rem] w-[1.125rem]"
                strokeWidth={2.25}
                aria-hidden
              />
            </Link>
          </Button>
        </SectionFilter>
      </DhoTabToolbarStack>

      {isLoading && filteredSignals.length === 0 ? (
        <div
          className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          aria-busy="true"
          aria-label={t('signals')}
        >
          {Array.from({ length: initialSkeletonCount }).map((_, i) => (
            <div
              key={`signal-skeleton-${i}`}
              className="flex min-h-[16rem] flex-col overflow-hidden rounded-lg border border-border/80 bg-card"
            >
              <Skeleton
                className="h-[5.25rem] w-full rounded-none"
                loading
                height="100%"
              />
              <div className="space-y-2 px-3 pb-3 pt-1">
                <div className="-mt-10 flex px-3">
                  <Skeleton
                    className="h-16 w-16 rounded-full"
                    loading
                    width="64px"
                    height="64px"
                  />
                </div>
                <Skeleton className="h-5 w-[65%]" loading height="20px" />
                <Skeleton className="h-4 w-24" loading height="16px" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" loading height="24px" />
                </div>
                <Skeleton className="h-16 w-full" loading />
                <Skeleton className="h-10 w-full" loading height="40px" />
              </div>
            </div>
          ))}
        </div>
      ) : pagination?.totalPages === 0 ? (
        <Empty>
          <p>{t('listIsEmpty')}</p>
        </Empty>
      ) : (
        <DhoTabListStack>
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
        </DhoTabListStack>
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
    </DhoTabSection>
  );
};
