'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { Button, SectionLoadMore } from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useTranslations } from 'next-intl';
import {
  DocumentState,
  SpaceMemoryItem,
  filterSpaceMemoryItems,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { SpaceMemoryTimelineItem } from './space-memory-timeline-item';
import { MemoryFilterValue, MemoryFilters } from './memory-filters';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';

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
    isLoadingMore,
    error,
    loadMoreError,
    refresh,
    searchTerm,
    setSearchTerm,
    hasMore,
    loadMore,
  } = useSpaceMemoryOrg(spaceSlug);
  const { space } = useSpaceBySlug(spaceSlug);
  const { canMutate, isLoading: isMutateLoading } = useCanMutateInSpace({
    spaceSlug,
    space,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const matrixChatRoomId = space?.chatRoomId?.trim() || null;
  const { lang, id } = useParams<{ lang: Locale; id: string }>();
  const [activeFilter, setActiveFilter] =
    React.useState<MemoryFilterValue>('general');

  const isAiChatItem = React.useCallback(
    (row: (typeof items)[number]) =>
      row.source === 'matrix_chat' &&
      row.context.documentLabel?.toLowerCase().includes('ai chat') === true,
    [],
  );

  const isConversationItem = React.useCallback(
    (row: SpaceMemoryItem) =>
      row.source === 'matrix_chat' || row.source === 'discussion_summary',
    [],
  );

  const isCallItem = React.useCallback(
    (row: SpaceMemoryItem) =>
      row.source === 'call_recording' || row.source === 'call_transcript',
    [],
  );

  const stateLabel = React.useCallback(
    (state: DocumentState) =>
      t(
        `documentStates.${state}` as
          | 'documentStates.discussion'
          | 'documentStates.proposal'
          | 'documentStates.agreement'
          | 'documentStates.memory',
      ),
    [t],
  );

  const contextLineForItem = React.useCallback(
    (row: SpaceMemoryItem) => {
      if (row.source === 'memory') {
        return t('spaceMemoryContextMemory', {
          title: row.context.documentTitle || t('untitledDocument'),
        });
      }
      if (row.source === 'matrix_chat') {
        return t('spaceMemoryContextMatrix');
      }
      if (row.source === 'discussion_summary') {
        return t('spaceMemoryContextDiscussionSummary');
      }
      if (row.source === 'call_transcript') {
        const signalTitle = row.context.signalTitle?.trim();
        return signalTitle
          ? t('spaceMemoryContextCallFromSignal', { title: signalTitle })
          : t('spaceMemoryContextCallTranscript');
      }
      if (row.source === 'call_recording') {
        const signalTitle = row.context.signalTitle?.trim();
        if (signalTitle) {
          return t('spaceMemoryContextCallRecordingFromSignal', {
            title: signalTitle,
          });
        }
        return t('spaceMemoryContextCallRecording');
      }
      return t('spaceMemoryContext', {
        title: row.context.documentTitle || t('untitledDocument'),
        state: stateLabel(row.context.documentState),
      });
    },
    [stateLabel, t],
  );

  const counts = React.useMemo(
    () =>
      ({
        general: items.length,
        proposals: items.filter(
          (row) =>
            row.source === 'proposal_upload' &&
            row.context.documentState === DocumentState.PROPOSAL,
        ).length,
        conversations: items.filter((row) => isConversationItem(row)).length,
        calls: items.filter((row) => isCallItem(row)).length,
        'ai-chat': items.filter((row) => isAiChatItem(row)).length,
      } satisfies Record<MemoryFilterValue, number>),
    [isAiChatItem, isCallItem, isConversationItem, items],
  );

  const filteredItems = React.useMemo(() => {
    const byFilter = items.filter((row) => {
      if (activeFilter === 'general') {
        return true;
      }
      if (activeFilter === 'proposals') {
        return (
          row.source === 'proposal_upload' &&
          row.context.documentState === DocumentState.PROPOSAL
        );
      }
      if (activeFilter === 'conversations') {
        return isConversationItem(row);
      }
      if (activeFilter === 'calls') {
        return isCallItem(row);
      }
      if (activeFilter === 'ai-chat') {
        return isAiChatItem(row);
      }
      return false;
    });

    return filterSpaceMemoryItems(byFilter, searchTerm);
  }, [
    activeFilter,
    isAiChatItem,
    isCallItem,
    isConversationItem,
    items,
    searchTerm,
  ]);

  const newMemoryHref = `/${lang}/dho/${id}/memory/new-memory`;

  return (
    <section
      className="flex w-full flex-col gap-4 py-2"
      aria-label={t('spaceMemory')}
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          {t('spaceMemory')}
          {typeof totalCount === 'number' ? (
            <span className="ml-2 text-5 font-medium text-muted-foreground">
              | {Intl.NumberFormat(lang).format(totalCount)}
            </span>
          ) : null}
        </h1>
      </header>
      <MemoryFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        newMemoryHref={newMemoryHref}
        canCreateMemory={canMutate}
        isCreateMemoryLoading={isMutateLoading}
        counts={counts}
      />

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
      ) : filteredItems.length === 0 ? (
        <Empty>
          <p>
            {searchTerm.trim()
              ? t('spaceMemoryEmptySearch')
              : activeFilter === 'ai-chat'
              ? t('spaceMemoryAiChatEmpty')
              : activeFilter === 'calls'
              ? t('spaceMemoryCallsEmpty')
              : activeFilter === 'general'
              ? t('spaceMemoryEmpty')
              : t('spaceMemoryEmptyTab')}
          </p>
        </Empty>
      ) : (
        <>
          <ul
            className="m-0 grid w-full list-none grid-cols-1 items-stretch gap-4 p-0 md:grid-cols-2 xl:grid-cols-3"
            aria-label={t('spaceMemory')}
          >
            {filteredItems.map((row) => (
              <SpaceMemoryTimelineItem
                key={row.id}
                item={row}
                contextLine={contextLineForItem(row)}
                matrixChatRoomId={matrixChatRoomId}
                openLabel={t('spaceMemoryOpenAsset', {
                  name: row.name,
                })}
              />
            ))}
          </ul>
          {totalCount > 0 ? (
            <div className="flex w-full flex-col items-center gap-2">
              <SectionLoadMore
                onClick={loadMore}
                disabled={!hasMore}
                isLoading={isLoadingMore}
              >
                <Text className="line-clamp-3 max-w-md text-center text-sm leading-snug">
                  {hasMore ? t('loadMore') : t('noMore')}
                </Text>
              </SectionLoadMore>
              {loadMoreError ? (
                <Text className="max-w-md text-center text-sm text-destructive">
                  {t('spaceMemoryLoadMoreError')}
                </Text>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};
