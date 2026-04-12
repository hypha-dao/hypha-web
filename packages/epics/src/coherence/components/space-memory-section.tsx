'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Button, SectionFilter, Separator } from '@hypha-platform/ui';
import { Empty } from '../../common';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { formatDate } from '@hypha-platform/ui-utils';
import React from 'react';
import { useTranslations } from 'next-intl';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';

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
        <ul className="w-full space-y-2 list-none p-0 m-0" role="list">
          {items.map((row) => (
            <li key={row.id} role="listitem">
              <div className="flex flex-row items-start justify-between gap-3 rounded-md border border-border px-3 py-2 bg-card">
                <div className="min-w-0 flex-1">
                  <Text className="text-foreground font-medium truncate block">
                    {row.name}
                  </Text>
                  <Text className="text-muted-foreground text-2 block truncate">
                    {t('spaceMemoryContext', {
                      title: row.context.documentTitle || t('untitledDocument'),
                      state: stateLabel(row.context.documentState),
                    })}
                  </Text>
                  <Text className="text-muted-foreground text-1">
                    {formatDate(new Date(row.uploadedAt), true)}
                  </Text>
                </div>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center justify-center rounded-md p-2 text-accent-11 hover:bg-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('spaceMemoryOpenAsset', { name: row.name })}
                >
                  <ExternalLinkIcon />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
