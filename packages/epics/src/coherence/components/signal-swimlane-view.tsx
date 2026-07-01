'use client';

import React from 'react';
import {
  Coherence,
  SignalBoardDefinition,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
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

type SignalSwimlaneViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  onPatch: (
    signal: Coherence,
    patch: {
      progressStatus?: string | null;
      board?: string | null;
    },
  ) => Promise<void>;
  refresh: () => Promise<void>;
  readOnly?: boolean;
};

const UNCategorized_SLUG = '__uncategorized__';

export function SignalSwimlaneView({
  signals,
  workflow,
  onSignalClick,
  onPatch,
  refresh,
  readOnly = false,
}: SignalSwimlaneViewProps) {
  const t = useTranslations('CoherenceTab');
  const [draggingSignal, setDraggingSignal] = React.useState<Coherence | null>(
    null,
  );
  const [dropTargetKey, setDropTargetKey] = React.useState<string | null>(null);
  const draggingSlugRef = React.useRef<string | null>(null);

  const statuses = React.useMemo(() => workflow.statuses, [workflow.statuses]);

  const lanes = React.useMemo(
    (): Array<{ slug: string; board: SignalBoardDefinition | null }> => [
      ...workflow.boards
        .filter((board) => !board.archived)
        .map((board) => ({ slug: board.slug, board })),
      { slug: UNCategorized_SLUG, board: null },
    ],
    [workflow.boards],
  );

  const byBoardAndStatus = React.useMemo(() => {
    const map = new Map<string, Map<string, Coherence[]>>();
    const fallbackStatus = statuses[0]?.slug ?? 'backlog';

    for (const lane of lanes) {
      const statusMap = new Map<string, Coherence[]>();
      for (const status of statuses) {
        statusMap.set(status.slug, []);
      }
      map.set(lane.slug, statusMap);
    }

    for (const signal of signals) {
      const laneKey = signal.board ?? UNCategorized_SLUG;
      const statusMap = map.get(laneKey) ?? map.get(UNCategorized_SLUG)!;
      const statusKey =
        signal.progressStatus != null && statusMap.has(signal.progressStatus)
          ? signal.progressStatus
          : fallbackStatus;
      statusMap.get(statusKey)!.push(signal);
    }

    return map;
  }, [lanes, signals, statuses]);

  const clearDragState = React.useCallback(() => {
    draggingSlugRef.current = null;
    setDraggingSignal(null);
    setDropTargetKey(null);
  }, []);

  const resolveDraggingSignal = React.useCallback(
    (slug: string | null) => {
      if (!slug) return null;
      return signals.find((item) => item.slug === slug) ?? draggingSignal;
    },
    [draggingSignal, signals],
  );

  return (
    <div className="flex w-full flex-col gap-5">
      {lanes.map((lane) => {
        const statusMap = byBoardAndStatus.get(lane.slug)!;
        const laneCount = [...statusMap.values()].reduce(
          (sum, bucket) => sum + bucket.length,
          0,
        );
        const laneBoard = lane.slug === UNCategorized_SLUG ? null : lane.slug;

        return (
          <section
            key={lane.slug}
            className="w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border/40 bg-gradient-to-r from-muted/35 via-muted/15 to-transparent px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-8 w-1 shrink-0 rounded-full bg-accent-9" />
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {lane.board?.name ?? t('signalBoardUncategorized')}
                </h3>
              </div>
              <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {laneCount}
              </span>
            </header>

            <div className="flex w-full gap-3 overflow-x-auto p-3">
              {statuses.map((status, index) => {
                const columnSignals = statusMap.get(status.slug) ?? [];
                const dropKey = `${lane.slug}:${status.slug}`;
                const isDropTarget = dropTargetKey === dropKey;
                const showPlaceholder =
                  !readOnly &&
                  isDropTarget &&
                  draggingSignal != null &&
                  (draggingSignal.progressStatus !== status.slug ||
                    draggingSignal.board !== laneBoard);

                return (
                  <div
                    key={dropKey}
                    className={cn(
                      'flex min-w-[15.5rem] flex-1 flex-col rounded-xl border border-t-[3px] bg-muted/10 transition-[border-color,box-shadow]',
                      statusColumnTopBorderClass(status.color),
                      isDropTarget
                        ? 'border-accent-8/70 ring-2 ring-accent-9/25 shadow-md'
                        : 'border-border/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/30 px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            statusColorDotClass(status.color),
                          )}
                          aria-hidden
                        />
                        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {status.name}
                        </span>
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {columnSignals.length}
                      </span>
                    </div>

                    <div
                      className="flex min-h-[6rem] flex-col gap-2 p-2"
                      onDragOver={
                        readOnly
                          ? undefined
                          : (event) => {
                              handleColumnDragOver(event);
                              setDropTargetKey(dropKey);
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
                                setDropTargetKey((current) =>
                                  current === dropKey ? null : current,
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
                              if (!signal) {
                                clearDragState();
                                return;
                              }

                              const patch: {
                                progressStatus?: string;
                                board?: string | null;
                              } = {};
                              if (signal.progressStatus !== status.slug) {
                                patch.progressStatus = status.slug;
                              }
                              if (signal.board !== laneBoard) {
                                patch.board = laneBoard;
                              }
                              if (Object.keys(patch).length === 0) {
                                clearDragState();
                                return;
                              }
                              void onPatch(signal, patch).catch((error) => {
                                console.error(
                                  '[SignalSwimlaneView] Failed to move signal',
                                  error,
                                );
                              });
                              clearDragState();
                            }
                      }
                    >
                      {columnSignals.map((signal) => (
                        <SignalTaskCard
                          key={signal.id}
                          signal={signal}
                          status={status}
                          showBoard={false}
                          board={lane.board}
                          draggable={!readOnly}
                          refresh={refresh}
                          onDragOver={
                            readOnly
                              ? undefined
                              : (event) => {
                                  handleColumnDragOver(event);
                                  setDropTargetKey(dropKey);
                                }
                          }
                          onDragStart={
                            readOnly
                              ? undefined
                              : (event) => {
                                  if (!signal.slug) return;
                                  setSignalDragData(event, signal.slug);
                                  draggingSlugRef.current = signal.slug;
                                  setDraggingSignal(signal);
                                }
                          }
                          onDragEnd={readOnly ? undefined : clearDragState}
                          onClick={
                            onSignalClick
                              ? () => onSignalClick(signal)
                              : undefined
                          }
                          className={cn(
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
                            'flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-4 text-center text-[11px] text-muted-foreground',
                            isDropTarget
                              ? 'border-accent-8/50 bg-accent-2/20'
                              : 'border-border/40',
                          )}
                        >
                          {t('signalColumnEmpty')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
