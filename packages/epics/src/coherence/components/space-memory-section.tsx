'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import {
  Button,
  SectionFilter,
  SectionLoadMore,
  Separator,
} from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useTranslations } from 'next-intl';
import {
  DocumentState,
  EventType,
  RoomEvent,
  useMatrix,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { SpaceMemoryTimelineItem } from './space-memory-timeline-item';

const MATRIX_SPACE_MEMORY_REFRESH_DEBOUNCE_MS = 1_800;

type SpaceMemorySectionProps = {
  spaceSlug: string;
  /**
   * When true (Artifact tab), render as a full-width section without the
   * inner top border from the Coherence “stacked card” layout.
   */
  standalonePage?: boolean;
};

export const SpaceMemorySection: FC<SpaceMemorySectionProps> = ({
  spaceSlug,
  standalonePage = false,
}) => {
  const t = useTranslations('CoherenceTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const { client, isMatrixAvailable } = useMatrix();
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

  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    const chatRoomId = space?.chatRoomId?.trim();
    if (!chatRoomId || !client || !isMatrixAvailable) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        void refresh();
      }, MATRIX_SPACE_MEMORY_REFRESH_DEBOUNCE_MS);
    };

    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      _toStart: boolean | undefined,
      removed: boolean,
      data: { liveEvent?: boolean },
    ) => {
      if (room?.roomId !== chatRoomId) return;
      if (removed) return;
      if (data?.liveEvent === false) return;
      if (event.getType() !== EventType.RoomMessage) return;
      scheduleRefresh();
    };

    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      client.removeListener(RoomEvent.Timeline, onTimeline);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [space?.chatRoomId, client, isMatrixAvailable, refresh]);

  const stateLabel = (state: DocumentState) =>
    t(
      `documentStates.${state}` as
        | 'documentStates.discussion'
        | 'documentStates.proposal'
        | 'documentStates.agreement',
    );

  return (
    <section
      className={
        standalonePage
          ? 'flex w-full flex-col gap-5'
          : 'flex w-full flex-col gap-5 border-t border-border/50 pt-10'
      }
      aria-label={standalonePage ? t('artifact') : t('spaceMemory')}
    >
      <SectionFilter
        count={totalCount}
        label={standalonePage ? t('artifact') : t('spaceMemory')}
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
      <Separator className="bg-border/70" />

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
        <>
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
                        title:
                          row.context.documentTitle || t('untitledDocument'),
                        state: stateLabel(row.context.documentState),
                      })
                }
                openLabel={t('spaceMemoryOpenAsset', { name: row.name })}
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
