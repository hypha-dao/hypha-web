'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Button, SectionFilter, Separator } from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { SpaceMemoryAssetCard } from './space-memory-asset-card';

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

  const stateLabel = (state: string) =>
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
          className="grid w-full list-none grid-cols-1 gap-4 p-0 m-0 md:grid-cols-2"
          role="list"
        >
          {items.map((row) => (
            <li key={row.id} role="listitem" className="min-w-0">
              <SpaceMemoryAssetCard
                item={row}
                contextLine={t('spaceMemoryContext', {
                  title: row.context.documentTitle || t('untitledDocument'),
                  state: stateLabel(row.context.documentState),
                })}
                openLabel={t('spaceMemoryOpenAsset', { name: row.name })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
