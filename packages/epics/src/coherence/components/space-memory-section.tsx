'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Button, SectionFilter, Separator } from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useTranslations } from 'next-intl';
import { DocumentState } from '@hypha-platform/core/client';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { SpaceMemoryTimelineItem } from './space-memory-timeline-item';

type SpaceMemorySectionProps = {
  spaceSlug: string;
};

export const SpaceMemorySection: FC<SpaceMemorySectionProps> = ({
  spaceSlug,
}) => {
  const t = useTranslations('CoherenceTab');
  const {
    items,
    totalCount,
    isLoading,
    error,
    refresh,
    searchTerm,
    setSearchTerm,
  } = useSpaceMemoryOrg(spaceSlug);

  const stateLabel = (state: DocumentState) =>
    t(
      `documentStates.${state}` as
        | 'documentStates.discussion'
        | 'documentStates.proposal'
        | 'documentStates.agreement',
    );

  return (
    <section
      className="flex flex-col justify-around items-center gap-4 w-full"
      aria-label={t('spaceMemory')}
    >
      <SectionFilter
        count={totalCount}
        label={t('spaceMemory')}
        hasSearch={true}
        searchPlaceholder={t('searchSpaceMemory')}
        onChangeSearch={setSearchTerm}
        inlineLabel={true}
      >
        <Button
          type="button"
          variant="ghost"
          colorVariant="accent"
          disabled={isLoading}
          onClick={() => void refresh()}
        >
          {t('spaceMemoryRefresh')}
        </Button>
      </SectionFilter>
      <Separator />

      {error ? (
        <div className="flex flex-col items-center gap-2 w-full px-4">
          <Text className="text-muted-foreground text-center">
            {t('spaceMemoryError')}
          </Text>
          <Button
            type="button"
            variant="outline"
            colorVariant="accent"
            onClick={() => void refresh()}
          >
            {t('spaceMemoryRetry')}
          </Button>
        </div>
      ) : isLoading ? (
        <Text className="text-muted-foreground">{t('spaceMemoryLoading')}</Text>
      ) : items.length === 0 ? (
        <Empty>
          <p>
            {searchTerm.trim()
              ? t('spaceMemoryEmptySearch')
              : t('spaceMemoryEmpty')}
          </p>
        </Empty>
      ) : (
        <ul
          className="m-0 flex w-full list-none flex-wrap justify-start gap-x-6 gap-y-10 p-0"
          aria-label={t('spaceMemoryTimelineLabel')}
        >
          {items.map((row) => (
            <SpaceMemoryTimelineItem
              key={row.id}
              item={row}
              contextLine={
                row.source === 'matrix_chat'
                  ? t('spaceMemoryContextMatrix')
                  : t('spaceMemoryContext', {
                      title: row.context.documentTitle || t('untitledDocument'),
                      state: stateLabel(row.context.documentState),
                    })
              }
              openLabel={t('spaceMemoryOpenAsset', { name: row.name })}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
