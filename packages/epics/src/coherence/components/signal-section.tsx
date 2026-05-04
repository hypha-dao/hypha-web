'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { useSignalsSection } from '../hooks';
import { Button, SectionFilter, SectionLoadMore } from '@hypha-platform/ui';
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
  leadImage?: string;
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
  leadImage,
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
              leadImage={leadImage}
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
