'use client';

import React from 'react';
import { Coherence, SignalWorkflowConfig } from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useIsMobile,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { SignalTaskCard } from './signal-task-card';
import { SignalDropPlaceholder } from './signal-drop-placeholder';
import {
  statusColorDotClass,
  statusColumnTopBorderClass,
} from '../utils/signal-priority-styles';
import {
  getSignalDragSlug,
  handleColumnDragOver,
  isDragLeaveColumn,
  setSignalDragData,
} from '../utils/signal-dnd-utils';
import { isSignalSlugActive } from '../utils/signal-active-styles';
import { handleSignalColumnShellWheel } from '../utils/signal-column-scroll-chain';
import {
  SIGNAL_KANBAN_COLUMN_SHELL_CLASS,
  SIGNAL_KANBAN_TASK_CARD_SHELL_CLASS,
} from '../utils/signal-board-layout';
import { SignalStatusCardStack } from './signal-status-card-stack';
import { resolveEffectiveBoard } from '@hypha-platform/core/client';

const SIGNAL_BOARD_MOBILE_STATUS_KEY = 'signal-board-mobile-status';

type SignalBoardViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  spaceSlug?: string;
  onSignalClick?: (signal: Coherence) => void;
  activeSignalSlug?: string | null;
  onMoveStatus: (signal: Coherence, progressStatus: string) => Promise<void>;
  refresh: () => Promise<void>;
  readOnly?: boolean;
};

function resolveStoredMobileStatus(
  spaceSlug: string | undefined,
  statuses: SignalWorkflowConfig['statuses'],
): string {
  const fallback = statuses[0]?.slug ?? 'backlog';
  if (!spaceSlug || typeof window === 'undefined') return fallback;
  try {
    const stored = sessionStorage.getItem(
      `${SIGNAL_BOARD_MOBILE_STATUS_KEY}:${spaceSlug}`,
    );
    if (stored && statuses.some((status) => status.slug === stored)) {
      return stored;
    }
  } catch {
    // sessionStorage may be unavailable
  }
  return fallback;
}

export function SignalBoardView({
  signals,
  workflow,
  spaceSlug,
  onSignalClick,
  activeSignalSlug,
  onMoveStatus,
  refresh,
  readOnly = false,
}: SignalBoardViewProps) {
  const t = useTranslations('CoherenceTab');
  const isMobile = useIsMobile() ?? false;
  const [draggingSignal, setDraggingSignal] = React.useState<Coherence | null>(
    null,
  );
  const [dropTargetSlug, setDropTargetSlug] = React.useState<string | null>(
    null,
  );
  const draggingSlugRef = React.useRef<string | null>(null);

  const statuses = React.useMemo(() => workflow.statuses, [workflow.statuses]);

  const [mobileStatusSlug, setMobileStatusSlug] = React.useState<string>(() =>
    resolveStoredMobileStatus(spaceSlug, statuses),
  );

  React.useEffect(() => {
    setMobileStatusSlug((current) => {
      if (statuses.some((status) => status.slug === current)) return current;
      return resolveStoredMobileStatus(spaceSlug, statuses);
    });
  }, [spaceSlug, statuses]);

  const handleMobileStatusChange = React.useCallback(
    (slug: string) => {
      setMobileStatusSlug(slug);
      if (!spaceSlug) return;
      try {
        sessionStorage.setItem(
          `${SIGNAL_BOARD_MOBILE_STATUS_KEY}:${spaceSlug}`,
          slug,
        );
      } catch {
        // sessionStorage may be unavailable
      }
    },
    [spaceSlug],
  );

  const byStatus = React.useMemo(() => {
    const map = new Map<string, Coherence[]>();
    for (const status of statuses) {
      map.set(status.slug, []);
    }
    const fallbackSlug = statuses[0]?.slug ?? 'backlog';
    for (const signal of signals) {
      const key =
        signal.progressStatus != null && map.has(signal.progressStatus)
          ? signal.progressStatus
          : fallbackSlug;
      map.get(key)!.push(signal);
    }
    return map;
  }, [signals, statuses]);

  const clearDragState = React.useCallback(() => {
    draggingSlugRef.current = null;
    setDraggingSignal(null);
    setDropTargetSlug(null);
  }, []);

  const resolveDraggingSignal = React.useCallback(
    (slug: string | null) => {
      if (!slug) return null;
      return signals.find((item) => item.slug === slug) ?? draggingSignal;
    },
    [draggingSignal, signals],
  );

  const visibleStatuses = isMobile
    ? statuses.filter((status) => status.slug === mobileStatusSlug)
    : statuses;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-3 md:hidden">
        <label
          htmlFor="signal-board-mobile-status"
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {t('signalListStatus')}
        </label>
        <Select
          value={mobileStatusSlug}
          onValueChange={handleMobileStatusChange}
        >
          <SelectTrigger
            id="signal-board-mobile-status"
            className="h-9 w-full border-border/60 bg-background/80"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.slug} value={status.slug}>
                <span className="inline-flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      statusColorDotClass(status.color),
                    )}
                    aria-hidden
                  />
                  <span>{status.name}</span>
                  <span className="text-muted-foreground">
                    ({byStatus.get(status.slug)?.length ?? 0})
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'flex w-full gap-4',
          isMobile
            ? 'flex-col pb-1'
            : 'items-start overflow-x-auto pb-3 pt-0.5',
        )}
      >
        {visibleStatuses.map((status) => {
          const columnSignals = byStatus.get(status.slug) ?? [];
          const isDropTarget = dropTargetSlug === status.slug;
          const showPlaceholder =
            !readOnly &&
            isDropTarget &&
            draggingSignal != null &&
            draggingSignal.progressStatus !== status.slug;

          return (
            <div
              key={status.slug}
              className={cn(
                'flex flex-col rounded-lg border border-t-[3px] bg-gradient-to-b from-muted/25 to-muted/5 transition-[border-color,box-shadow]',
                statusColumnTopBorderClass(status.color),
                isMobile ? 'w-full min-w-0' : 'min-w-[17.5rem] flex-1',
                SIGNAL_KANBAN_COLUMN_SHELL_CLASS,
                isDropTarget
                  ? 'border-accent-8/70 ring-2 ring-accent-9/30 shadow-md'
                  : 'border-border/50',
              )}
              onWheel={handleSignalColumnShellWheel}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      statusColorDotClass(status.color),
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                    {status.name}
                  </span>
                </div>
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {columnSignals.length}
                </span>
              </div>

              <SignalStatusCardStack
                onDragOver={
                  readOnly
                    ? undefined
                    : (event) => {
                        handleColumnDragOver(event);
                        setDropTargetSlug(status.slug);
                      }
                }
                onDragLeave={
                  readOnly
                    ? undefined
                    : (event) => {
                        if (
                          isDragLeaveColumn(
                            event,
                            event.currentTarget as HTMLElement,
                          )
                        ) {
                          setDropTargetSlug((current) =>
                            current === status.slug ? null : current,
                          );
                        }
                      }
                }
                onDrop={
                  readOnly
                    ? undefined
                    : (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const slug = getSignalDragSlug(
                          event,
                          draggingSlugRef.current,
                        );
                        if (!slug) {
                          clearDragState();
                          return;
                        }
                        const signal = resolveDraggingSignal(slug);
                        if (!signal || signal.progressStatus === status.slug) {
                          clearDragState();
                          return;
                        }
                        void onMoveStatus(signal, status.slug).catch(
                          (error) => {
                            console.error(
                              '[SignalBoardView] Failed to move signal',
                              error,
                            );
                          },
                        );
                        clearDragState();
                      }
                }
              >
                {columnSignals.map((signal) => (
                  <SignalTaskCard
                    key={signal.id}
                    signal={signal}
                    isActive={isSignalSlugActive(signal.slug, activeSignalSlug)}
                    status={status}
                    showBoard
                    board={
                      workflow.boards.find(
                        (board) =>
                          board.slug ===
                          resolveEffectiveBoard(signal.board, workflow),
                      ) ?? null
                    }
                    draggable={!readOnly && !isMobile}
                    refresh={refresh}
                    onDragOver={
                      readOnly || isMobile
                        ? undefined
                        : (event) => {
                            handleColumnDragOver(event);
                            setDropTargetSlug(status.slug);
                          }
                    }
                    onDragStart={
                      readOnly || isMobile
                        ? undefined
                        : (event) => {
                            if (!signal.slug) return;
                            setSignalDragData(event, signal.slug);
                            draggingSlugRef.current = signal.slug;
                            setDraggingSignal(signal);
                          }
                    }
                    onDragEnd={
                      readOnly || isMobile ? undefined : clearDragState
                    }
                    onClick={
                      onSignalClick ? () => onSignalClick(signal) : undefined
                    }
                    className={cn(
                      SIGNAL_KANBAN_TASK_CARD_SHELL_CLASS,
                      draggingSignal?.slug === signal.slug &&
                        'opacity-40 scale-[0.98]',
                    )}
                  />
                ))}

                {showPlaceholder ? (
                  <SignalDropPlaceholder signal={draggingSignal} />
                ) : null}

                {columnSignals.length === 0 && !showPlaceholder ? (
                  <div
                    className={cn(
                      'flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground',
                      isDropTarget
                        ? 'border-accent-8/50 bg-accent-2/20'
                        : 'border-border/50',
                    )}
                  >
                    {t('signalColumnEmpty')}
                  </div>
                ) : null}
              </SignalStatusCardStack>
            </div>
          );
        })}
      </div>
    </div>
  );
}
