'use client';

import { type ElementType, type FC } from 'react';
import Link from 'next/link';
import {
  FileText,
  MessagesSquare,
  Radio,
  SearchIcon,
  Sparkles,
} from 'lucide-react';
import { Button, Input } from '@hypha-platform/ui';
import { Empty } from '../../common';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DocumentState,
  SpaceMemoryItem,
  deriveSpaceMemoryDisplayTitle,
  filterSpaceMemoryItems,
  memoryBodyWithoutRepeatedTitle,
  spaceMemoryBranchForItem,
  type SpaceMemoryBranch,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useSpaceMemoryOrg } from '../hooks/use-space-memory-org';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { SpaceMemoryTimelineItem } from './space-memory-timeline-item';
import { MemoryProse } from './memory-prose';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { cn, stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { spaceMemoryListHeight } from './space-memory-list-height';
import { useChainScrollAtEdge } from '../../common/chain-scroll-at-edge';

type SpaceMemorySectionProps = {
  spaceSlug: string;
};

const DESKTOP_MENU = '(min-width: 80rem)';
const DESKTOP_SPLIT = '(min-width: 64rem)';

const BRANCH_ICONS: Record<SpaceMemoryBranch, ElementType> = {
  conversations: MessagesSquare,
  calls: Radio,
  ai: Sparkles,
  files: FileText,
};

function mobileTabOffset(): number {
  if (typeof window === 'undefined') return 0;
  if (window.matchMedia(DESKTOP_MENU).matches) return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--mobile-tab-offset')
    .trim();
  if (!raw) return 96;
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.height = raw;
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height || 96;
}

export const SpaceMemorySection: FC<SpaceMemorySectionProps> = ({
  spaceSlug,
}) => {
  const t = useTranslations('CoherenceTab');
  const {
    items,
    totalCount,
    categoryCounts,
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
  const [branch, setBranch] =
    React.useState<SpaceMemoryBranch>('conversations');
  const branchChosen = React.useRef(false);
  const listFrameRef = React.useRef<HTMLDivElement | null>(null);
  const listScrollRef = React.useRef<HTMLDivElement | null>(null);
  const chainScroll = useChainScrollAtEdge();
  const setListScroll = React.useCallback(
    (node: HTMLDivElement | null) => {
      listScrollRef.current = node;
      chainScroll(node);
    },
    [chainScroll],
  );
  const listEndRef = React.useRef<HTMLLIElement | null>(null);

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

  // Space orientation — the space's own description, not the latest memory item.
  const spaceOrientation = React.useMemo(() => {
    const raw = space?.description?.trim() ?? '';
    if (!raw) return '';
    return stripMarkdown(stripDescription(raw), {
      extraNewlines: true,
    }).trim();
  }, [space?.description]);

  const conversations = React.useMemo(
    () =>
      visible.filter(
        (row) => spaceMemoryBranchForItem(row) === 'conversations',
      ),
    [visible],
  );
  const calls = React.useMemo(
    () => visible.filter((row) => spaceMemoryBranchForItem(row) === 'calls'),
    [visible],
  );
  const aiDiscussions = React.useMemo(
    () => visible.filter((row) => spaceMemoryBranchForItem(row) === 'ai'),
    [visible],
  );
  const files = React.useMemo(
    () => visible.filter((row) => spaceMemoryBranchForItem(row) === 'files'),
    [visible],
  );
  const branches: Array<{
    id: SpaceMemoryBranch;
    label: string;
    body: string;
    count: number;
  }> = [
    {
      id: 'conversations',
      label: t('spaceMemoryConversations'),
      body: t('spaceMemoryConversationsBody'),
      count: categoryCounts.conversations,
    },
    {
      id: 'calls',
      label: t('spaceMemoryCalls'),
      body: t('spaceMemoryCallsBody'),
      count: categoryCounts.calls,
    },
    {
      id: 'ai',
      label: t('spaceMemoryAiDiscussions'),
      body: t('spaceMemoryAiDiscussionsBody'),
      count: categoryCounts.ai,
    },
    {
      id: 'files',
      label: t('spaceMemoryFiles'),
      body: t('spaceMemoryFilesBody'),
      count: categoryCounts.files,
    },
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
    if (categoryCounts.conversations > 0) return;
    if (categoryCounts.calls > 0) setBranch('calls');
    else if (categoryCounts.ai > 0) setBranch('ai');
    else if (categoryCounts.files > 0) setBranch('files');
  }, [categoryCounts, isLoading, searchTerm]);

  // Keep fetching until the active category has rows or the catalog ends.
  React.useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    if (activeRows.length > 0) return;
    if (categoryCounts[branch] <= 0) return;
    loadMore();
  }, [
    activeRows.length,
    branch,
    categoryCounts,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
  ]);

  React.useEffect(() => {
    // Page still scrolls. Cap the right list to the viewport so it scrolls
    // inside its frame. Do not size from a scrolled frameTop — that grew
    // the box on every wheel tick and dragged the filters away.
    const fit = () => {
      const frame = listFrameRef.current;
      if (!frame) return;
      if (!window.matchMedia(DESKTOP_SPLIT).matches) {
        frame.style.height = '';
        frame.style.maxHeight = '';
        return;
      }
      const viewportBottom = window.visualViewport
        ? window.visualViewport.offsetTop + window.visualViewport.height
        : window.innerHeight;
      const rawMenu = getComputedStyle(document.documentElement)
        .getPropertyValue('--menu-top-height')
        .trim();
      let menuOffset = 72;
      if (rawMenu) {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.height = rawMenu;
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        menuOffset = probe.getBoundingClientRect().height || 72;
        probe.remove();
      }
      const height = spaceMemoryListHeight({
        viewportBottom,
        menuOffset,
        tabOffset: mobileTabOffset(),
      });
      frame.style.height = `${height}px`;
      frame.style.maxHeight = `${height}px`;
    };

    const observer = new ResizeObserver(fit);
    fit();
    observer.observe(document.documentElement);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      if (listFrameRef.current) {
        listFrameRef.current.style.height = '';
        listFrameRef.current.style.maxHeight = '';
      }
    };
  }, [isLoading, spaceOrientation, searchTerm]);

  React.useEffect(() => {
    if (isLoading || !hasMore) return;
    const root = listScrollRef.current;
    const sentinel = listEndRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadMore();
      },
      { root, rootMargin: '160px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeRows.length, hasMore, isLoading, isLoadingMore, loadMore]);

  const newMemoryHref = `/${lang}/dho/${id}/memory/new-memory`;

  return (
    <section
      className="flex w-full min-w-0 flex-col gap-4 py-2"
      aria-label={t('spaceMemory')}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-2">
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
      <div className="flex w-full shrink-0 items-center gap-2 lg:gap-3">
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
          <p className="text-center text-muted-foreground">
            {t('spaceMemoryError')}
          </p>
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
        <p className="text-muted-foreground">{t('spaceMemoryLoading')}</p>
      ) : (
        <>
          <article className="shrink-0 border border-border bg-background px-5 py-5">
            <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('spaceMemoryWhere')}
            </p>
            {spaceOrientation ? (
              <div className="mt-3 max-w-3xl text-3 leading-relaxed">
                <MemoryProse source={spaceOrientation} />
              </div>
            ) : (
              <p className="mt-3 max-w-3xl text-2 leading-relaxed text-neutral-11">
                {t('spaceMemoryWhereEmpty')}
              </p>
            )}
          </article>

          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col gap-4',
              'lg:flex-row lg:items-start lg:gap-6',
            )}
          >
            <nav
              aria-label={t('spaceMemoryOutline')}
              className="w-full shrink-0 self-start lg:w-80"
            >
              <div className="border border-border bg-background">
                {branches.map((item) => {
                  const Icon = BRANCH_ICONS[item.id];
                  const selected = branch === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      aria-pressed={selected}
                      onClick={() => {
                        branchChosen.current = true;
                        setBranch(item.id);
                        listScrollRef.current?.scrollTo({ top: 0 });
                      }}
                      className={cn(
                        'flex w-full min-w-0 items-start gap-3 border-b border-border px-4 py-4 text-left hover:bg-accent-2',
                        selected && 'bg-accent-2',
                      )}
                    >
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-3">
                          <span
                            className={cn(
                              'min-w-0 truncate text-3 text-foreground',
                              selected && 'font-medium',
                            )}
                          >
                            {item.label}
                          </span>
                          <span className="ml-auto shrink-0 text-1 text-muted-foreground">
                            {item.count}
                          </span>
                        </span>
                        <span className="mt-1 block text-2 text-muted-foreground">
                          {item.body}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div
              ref={listFrameRef}
              data-space-memory-list-frame=""
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible border border-border bg-background lg:overflow-hidden lg:sticky lg:top-[calc(var(--menu-top-height,4.5rem)+0.75rem)]"
            >
              <div
                ref={setListScroll}
                className="narrow-scrollbar min-h-0 flex-1 overflow-visible lg:overflow-y-auto lg:overscroll-contain"
              >
                {activeRows.length === 0 ? (
                  <div className="px-4 py-6">
                    <Empty>
                      <p>
                        {searchTerm.trim()
                          ? t('spaceMemoryEmptySearch')
                          : isLoadingMore ||
                            (hasMore && categoryCounts[branch] > 0)
                          ? t('spaceMemoryLoading')
                          : branch === 'calls'
                          ? t('spaceMemoryCallsEmpty')
                          : branch === 'ai'
                          ? t('spaceMemoryAiChatEmpty')
                          : branch === 'files'
                          ? t('spaceMemoryEmpty')
                          : t('spaceMemoryConversationsEmpty')}
                      </p>
                    </Empty>
                  </div>
                ) : branch === 'files' ? (
                  <ul className="m-0 grid list-none grid-cols-1 items-stretch gap-2 p-3 md:grid-cols-2">
                    {files.map((row) => (
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
                    <li ref={listEndRef} aria-hidden className="h-px w-full" />
                  </ul>
                ) : (
                  <ul className="m-0 grid list-none gap-4 p-3">
                    {activeRows.map((row) => {
                      const title = deriveSpaceMemoryDisplayTitle({
                        source: row.source,
                        name: row.name,
                        contextTitle: row.context.contextTitle,
                        textExcerpt: row.context.textExcerpt,
                        documentTitle: row.context.documentTitle,
                      });
                      const rawBody = row.context.textExcerpt?.trim() ?? '';
                      const body = memoryBodyWithoutRepeatedTitle(
                        title,
                        rawBody,
                      );
                      if (row.source === 'call_recording') {
                        return (
                          <SpaceMemoryTimelineItem
                            key={row.id}
                            item={row}
                            contextLine={contextLineForItem(row)}
                            matrixChatRoomId={matrixChatRoomId}
                            openLabel={t('spaceMemoryOpenAsset', {
                              name: row.name,
                            })}
                          />
                        );
                      }
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
                            style={{
                              fontFamily: 'var(--font-family-heading)',
                            }}
                          >
                            {title}
                          </h2>
                          <p className="mt-1 text-1 text-neutral-11">
                            {format.dateTime(new Date(row.uploadedAt), {
                              dateStyle: 'medium',
                            })}
                          </p>
                          {body ? (
                            <div className="mt-4 max-w-3xl">
                              <MemoryProse source={body} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                    <li ref={listEndRef} aria-hidden className="h-px w-full" />
                  </ul>
                )}
                {isLoadingMore ? (
                  <p className="px-4 py-3 text-center text-1 text-neutral-11">
                    {t('spaceMemoryLoading')}
                  </p>
                ) : null}
                {loadMoreError ? (
                  <p className="px-4 py-3 text-center text-1 text-destructive">
                    {t('spaceMemoryLoadMoreError')}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
