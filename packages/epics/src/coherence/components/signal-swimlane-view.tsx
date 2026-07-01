'use client';

import React from 'react';
import {
  Coherence,
  SignalBoardDefinition,
  SignalWorkflowConfig,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { SignalTaskCard } from './signal-task-card';
import { useTranslations } from 'next-intl';

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
  readOnly?: boolean;
};

const UNCategorized_SLUG = '__uncategorized__';

export function SignalSwimlaneView({
  signals,
  workflow,
  onSignalClick,
  onPatch,
  readOnly = false,
}: SignalSwimlaneViewProps) {
  const t = useTranslations('CoherenceTab');
  const [draggingSlug, setDraggingSlug] = React.useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      {lanes.map((lane) => {
        const statusMap = byBoardAndStatus.get(lane.slug)!;
        const laneCount = [...statusMap.values()].reduce(
          (sum, bucket) => sum + bucket.length,
          0,
        );
        const laneBoard = lane.slug === UNCategorized_SLUG ? null : lane.slug;

        return (
          <div
            key={lane.slug}
            className="rounded-xl border border-border/60 bg-muted/10"
          >
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
              <span className="text-sm font-semibold">
                {lane.board?.name ?? t('signalBoardUncategorized')}
              </span>
              <span className="text-xs text-muted-foreground">{laneCount}</span>
            </div>

            <div className="flex gap-2 overflow-x-auto p-2">
              {statuses.map((status) => {
                const columnSignals = statusMap.get(status.slug) ?? [];
                return (
                  <div
                    key={`${lane.slug}-${status.slug}`}
                    className="flex w-56 shrink-0 flex-col rounded-lg border border-border/50 bg-muted/15"
                    onDragOver={
                      readOnly ? undefined : (event) => event.preventDefault()
                    }
                    onDrop={
                      readOnly
                        ? undefined
                        : async (event) => {
                            event.preventDefault();
                            const slug =
                              event.dataTransfer.getData('text/signal-slug');
                            setDraggingSlug(null);
                            if (!slug) return;
                            const signal = signals.find(
                              (item) => item.slug === slug,
                            );
                            if (!signal) return;

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
                            if (Object.keys(patch).length === 0) return;
                            await onPatch(signal, patch);
                          }
                    }
                  >
                    <div className="flex items-center justify-between border-b border-border/40 px-2 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {status.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {columnSignals.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {columnSignals.map((signal) => (
                        <SignalTaskCard
                          key={signal.id}
                          signal={signal}
                          status={status}
                          board={lane.board}
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
                          onDragEnd={
                            readOnly ? undefined : () => setDraggingSlug(null)
                          }
                          onClick={
                            onSignalClick
                              ? () => onSignalClick(signal)
                              : undefined
                          }
                          className={cn(
                            draggingSlug === signal.slug && 'opacity-50',
                          )}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
