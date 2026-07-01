'use client';

import React from 'react';
import { Coherence, SignalWorkflowConfig } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import { SignalTaskCard } from './signal-task-card';
import { SignalDropPlaceholder } from './signal-drop-placeholder';
import { statusColumnDotClass } from '../utils/signal-priority-styles';
import {
  getSignalDragSlug,
  handleColumnDragOver,
  isDragLeaveColumn,
  setSignalDragData,
} from '../utils/signal-dnd-utils';

type SignalBoardViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  onMoveStatus: (signal: Coherence, progressStatus: string) => Promise<void>;
  refresh: () => Promise<void>;
  readOnly?: boolean;
};

export function SignalBoardView({
  signals,
  workflow,
  onSignalClick,
  onMoveStatus,
  refresh,
  readOnly = false,
}: SignalBoardViewProps) {
  const t = useTranslations('CoherenceTab');
  const [draggingSignal, setDraggingSignal] = React.useState<Coherence | null>(
    null,
  );
  const [dropTargetSlug, setDropTargetSlug] = React.useState<string | null>(
    null,
  );
  const draggingSlugRef = React.useRef<string | null>(null);

  const statuses = React.useMemo(() => workflow.statuses, [workflow.statuses]);

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

  return (
    <div className="flex w-full gap-4 overflow-x-auto pb-3 pt-0.5">
      {statuses.map((status, index) => {
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
              'flex min-w-[17.5rem] flex-1 flex-col rounded-2xl border bg-gradient-to-b from-muted/25 to-muted/5 transition-[border-color,box-shadow]',
              isDropTarget
                ? 'border-accent-8/70 ring-2 ring-accent-9/30 shadow-md'
                : 'border-border/50',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    statusColumnDotClass(index),
                  )}
                  aria-hidden
                />
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                  {status.name}
                </span>
              </div>
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {columnSignals.length}
              </span>
            </div>

            <div
              className="flex min-h-[8rem] flex-col gap-2.5 p-2.5"
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
                  : async (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const slug = getSignalDragSlug(
                        event,
                        draggingSlugRef.current,
                      );
                      clearDragState();
                      if (!slug) return;
                      const signal = resolveDraggingSignal(slug);
                      if (!signal || signal.progressStatus === status.slug) {
                        return;
                      }
                      await onMoveStatus(signal, status.slug);
                    }
              }
            >
              {columnSignals.map((signal) => (
                <SignalTaskCard
                  key={signal.id}
                  signal={signal}
                  status={status}
                  showBoard
                  board={
                    workflow.boards.find(
                      (board) => board.slug === signal.board,
                    ) ?? null
                  }
                  draggable={!readOnly}
                  refresh={refresh}
                  onDragOver={
                    readOnly
                      ? undefined
                      : (event) => {
                          handleColumnDragOver(event);
                          setDropTargetSlug(status.slug);
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
                    onSignalClick ? () => onSignalClick(signal) : undefined
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
                    'flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-6 text-center text-xs text-muted-foreground',
                    isDropTarget
                      ? 'border-accent-8/50 bg-accent-2/20'
                      : 'border-border/50',
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
  );
}
