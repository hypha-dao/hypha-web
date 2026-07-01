'use client';

import React from 'react';
import {
  Coherence,
  SignalStatusDefinition,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { SignalTaskCard } from './signal-task-card';

type SignalBoardViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  onMoveStatus: (signal: Coherence, progressStatus: string) => Promise<void>;
  readOnly?: boolean;
};

export function SignalBoardView({
  signals,
  workflow,
  onSignalClick,
  onMoveStatus,
  readOnly = false,
}: SignalBoardViewProps) {
  const [draggingSlug, setDraggingSlug] = React.useState<string | null>(null);

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
      const bucket = map.get(key)!;
      bucket.push(signal);
    }
    return map;
  }, [signals, statuses]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map((status) => {
        const columnSignals = byStatus.get(status.slug) ?? [];
        return (
          <div
            key={status.slug}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-border/60 bg-muted/15"
            onDragOver={
              readOnly ? undefined : (event) => event.preventDefault()
            }
            onDrop={
              readOnly
                ? undefined
                : async (event) => {
                    event.preventDefault();
                    const slug = event.dataTransfer.getData('text/signal-slug');
                    setDraggingSlug(null);
                    if (!slug) return;
                    const signal = signals.find((item) => item.slug === slug);
                    if (!signal || signal.progressStatus === status.slug) {
                      return;
                    }
                    await onMoveStatus(signal, status.slug);
                  }
            }
          >
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {status.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {columnSignals.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {columnSignals.map((signal) => (
                <SignalTaskCard
                  key={signal.id}
                  signal={signal}
                  status={status}
                  board={
                    workflow.boards.find(
                      (board) => board.slug === signal.board,
                    ) ?? null
                  }
                  draggable={!readOnly}
                  onDragStart={
                    readOnly
                      ? undefined
                      : (event) => {
                          if (!signal.slug) return;
                          event.dataTransfer.setData(
                            'text/signal-slug',
                            signal.slug,
                          );
                          setDraggingSlug(signal.slug);
                        }
                  }
                  onDragEnd={readOnly ? undefined : () => setDraggingSlug(null)}
                  onClick={
                    onSignalClick ? () => onSignalClick(signal) : undefined
                  }
                  className={cn(draggingSlug === signal.slug && 'opacity-50')}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
