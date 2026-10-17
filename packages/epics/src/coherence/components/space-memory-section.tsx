'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import Link from 'next/link';
import { SearchIcon } from 'lucide-react';
import { Button, Input, SectionLoadMore } from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DocumentState,
  SpaceMemoryItem,
  deriveSpaceMemoryDisplayTitle,
  filterSpaceMemoryItems,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { SpaceMemoryTimelineItem } from './space-memory-timeline-item';
import { MemoryProse, firstMemoryParagraph } from './memory-prose';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';

type MemoryBranch = 'conversations' | 'calls' | 'ai' | 'files';

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
  const format = useFormatter();
  const [branch, setBranch] = React.useState<MemoryBranch>('conversations');
  const branchChosen = React.useRef(false);

  const isAiChatItem = React.useCallback(
    (row: SpaceMemoryItem) =>
      row.source === 'matrix_chat' &&
      row.context.documentLabel?.toLowerCase().includes('ai chat') === true,
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

  const visible = React.useMemo(
    () => filterSpaceMemoryItems(items, searchTerm),
    [items, searchTerm],
  );
  const conversations = React.useMemo(
    () => visible.filter((row) => row.source === 'discussion_summary'),
    [visible],
  );
  const calls = React.useMemo(
    () =>
      visible.filter(
        (row) =>
          row.source === 'call_recording' || row.source === 'call_transcript',
      ),
    [visible],
  );
  const aiDiscussions = React.useMemo(
    () => visible.filter((row) => isAiChatItem(row)),
    [isAiChatItem, visible],
  );
  const readingIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const row of conversations) ids.add(row.id);
    for (const row of calls) ids.add(row.id);
    for (const row of aiDiscussions) ids.add(row.id);
    return ids;
  }, [aiDiscussions, calls, conversations]);
  const files = React.useMemo(
    () => visible.filter((row) => !readingIds.has(row.id)),
    [readingIds, visible],
  );
  const lead = React.useMemo(() => {
    const written = items.find(
      (row) =>
        row.source === 'discussion_summary' &&
        Boolean(row.context.textExcerpt?.trim()),
    );
    if (written) return written;
    return (
      items.find(
        (row) =>
          row.source === 'call_transcript' &&
          Boolean(row.context.textExcerpt?.trim()),
      ) ?? null
    );
  }, [items]);
  const leadExcerpt = lead?.context.textExcerpt?.trim() ?? '';
  const leadText = leadExcerpt ? firstMemoryParagraph(leadExcerpt) : '';
  const branches: Array<{
    id: MemoryBranch;
    label: string;
    count: number;
  }> = [
    {
      id: 'conversations',
      label: t('spaceMemoryConversations'),
      count: conversations.length,
    },
    { id: 'calls', label: t('spaceMemoryCalls'), count: calls.length },
    {
      id: 'ai',
      label: t('spaceMemoryAiDiscussions'),
      count: aiDiscussions.length,
    },
    { id: 'files', label: t('spaceMemoryFiles'), count: files.length },
  ];
  const activeRows =
    branch === 'conversations'
      ? conversations
      : branch === 'calls'
      ? calls
      : branch === 'ai'
      ? aiDiscussions
      : files;

  React.useEffect(() => {
    if (branchChosen.current || isLoading || searchTerm.trim()) return;
    if (conversations.length > 0) return;
    if (calls.length > 0) setBranch('calls');
    else if (aiDiscussions.length > 0) setBranch('ai');
    else if (files.length > 0) setBranch('files');
  }, [
    aiDiscussions.length,
    calls.length,
    conversations.length,
    files.length,
    isLoading,
    searchTerm,
  ]);

  const newMemoryHref = `/${lang}/dho/${id}/memory/new-memory`;

  return (
    <section
      className="flex w-full flex-col gap-4 py-2"
      aria-label={t('spaceMemory')}
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="craft-page-header">
          <h1 className="craft-page-title text-6 font-medium">
            {t('spaceMemory')}
            {typeof totalCount === 'number' ? (
              <span className="ml-2 text-4 font-normal text-muted-foreground">
                | {Intl.NumberFormat(lang).format(totalCount)}
              </span>
            ) : null}
          </h1>
        </div>
      </header>
      <div className="flex w-full items-center gap-2 lg:gap-3">
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t('searchSpaceMemory')}
          aria-label={t('searchSpaceMemory')}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="min-w-0 flex-1"
        />
        {canMutate ? (
          <Button asChild variant="default" colorVariant="accent">
            <Link href={newMemoryHref} scroll={false}>
              {t('newMemory')}
            </Link>
          </Button>
        ) : (
          <Button
            variant="default"
            colorVariant="accent"
            disabled={isMutateLoading || !canMutate}
          >
            {t('newMemory')}
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex w-full flex-col items-center gap-2 px-4">
          <Text className="text-center text-muted-foreground">
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
      ) : (
        <>
          <article className="border border-border bg-background px-5 py-5">
            <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('spaceMemoryWhere')}
            </p>
            {lead && leadText ? (
              <>
                <div className="mt-3 max-w-3xl text-3 leading-relaxed">
                  <MemoryProse source={leadText} />
                </div>
                <p className="mt-3 text-1 text-neutral-11">
                  {format.dateTime(new Date(lead.uploadedAt), {
                    dateStyle: 'medium',
                  })}
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-3xl text-2 leading-relaxed text-neutral-11">
                {t('spaceMemoryWhereEmpty')}
              </p>
            )}
          </article>

          <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <nav
              aria-label={t('spaceMemoryOutline')}
              className="grid gap-px lg:sticky lg:top-4"
            >
              {branches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={branch === item.id ? 'true' : undefined}
                  onClick={() => {
                    branchChosen.current = true;
                    setBranch(item.id);
                  }}
                  className={cn(
                    'flex items-baseline justify-between gap-3 border border-transparent px-3 py-2 text-left text-1',
                    branch === item.id
                      ? 'border-foreground text-foreground'
                      : 'text-neutral-11 hover:text-foreground',
                  )}
                >
                  <span>{item.label}</span>
                  <span className="tabular-nums">{item.count}</span>
                </button>
              ))}
            </nav>

            <div className="min-w-0">
              {branch === 'files' ? (
                <p className="mb-4 text-1 text-neutral-11">
                  {t('spaceMemoryFilesHint')}
                </p>
              ) : null}
              {activeRows.length === 0 ? (
                <Empty>
                  <p>
                    {searchTerm.trim()
                      ? t('spaceMemoryEmptySearch')
                      : branch === 'calls'
                      ? t('spaceMemoryCallsEmpty')
                      : branch === 'ai'
                      ? t('spaceMemoryAiChatEmpty')
                      : branch === 'files'
                      ? t('spaceMemoryEmpty')
                      : t('spaceMemoryConversationsEmpty')}
                  </p>
                </Empty>
              ) : branch === 'files' ? (
                <ul className="m-0 grid list-none grid-cols-1 items-stretch gap-2 p-0 md:grid-cols-2">
                  {files.map((row) => (
                    <SpaceMemoryTimelineItem
                      key={row.id}
                      item={row}
                      contextLine={contextLineForItem(row)}
                      matrixChatRoomId={matrixChatRoomId}
                      openLabel={t('spaceMemoryOpenAsset', { name: row.name })}
                    />
                  ))}
                </ul>
              ) : (
                <ul className="m-0 grid list-none gap-4 p-0">
                  {activeRows.map((row) => {
                    const title = deriveSpaceMemoryDisplayTitle({
                      source: row.source,
                      name: row.name,
                      contextTitle: row.context.contextTitle,
                      textExcerpt: row.context.textExcerpt,
                      documentTitle: row.context.documentTitle,
                    });
                    const body = row.context.textExcerpt?.trim() ?? '';
                    const media =
                      row.url.startsWith('http://') ||
                      row.url.startsWith('https://')
                        ? row.url
                        : null;
                    return (
                      <li
                        key={row.id}
                        className="border border-border bg-background px-5 py-5"
                      >
                        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                          {contextLineForItem(row)}
                        </p>
                        <h2
                          className="mt-2 text-3"
                          style={{ fontFamily: 'var(--font-family-heading)' }}
                        >
                          {title}
                        </h2>
                        <p className="mt-1 text-1 text-neutral-11">
                          {format.dateTime(new Date(row.uploadedAt), {
                            dateStyle: 'medium',
                          })}
                        </p>
                        {row.source === 'call_recording' && media ? (
                          row.kind === 'video' ? (
                            <video
                              controls
                              src={media}
                              className="mt-4 max-h-72 w-full bg-background"
                              preload="metadata"
                            >
                              <track kind="captions" />
                            </video>
                          ) : (
                            <audio
                              controls
                              src={media}
                              className="mt-4 w-full"
                              preload="metadata"
                            >
                              <track kind="captions" />
                            </audio>
                          )
                        ) : null}
                        {body ? (
                          <div className="mt-4 max-w-3xl">
                            <MemoryProse source={body} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

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
