'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePersonById, type Coherence } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import {
  getSignalDragSlug,
  handleColumnDragOver,
  isDragLeaveColumn,
  setSignalDragData,
} from '../utils/signal-dnd-utils';
import {
  readCollapsedSignalLanes,
  toggleCollapsedSignalLane,
  writeCollapsedSignalLanes,
} from '../lib/signal-lane-collapse';
import {
  UNKNOWN_CREATOR_COLUMN,
  type SignalLane,
  type SignalLaneColumns,
} from '../lib/signal-swimlanes';
import { SignalTypeBadge } from './signal-type-badge';

type SignalSwimlanesProps = {
  lanes: SignalLane<Coherence>[];
  columns: SignalLaneColumns;
  spaceSlug: string;
  /** Renders one signal; the feed row, so both views look the same. */
  renderSignal: (signal: Coherence) => React.ReactNode;
  /** When set, signals can be dragged to another row (board). */
  onMoveToBoard?: (signal: Coherence, board: string) => void;
};

function CreatorColumnLabel({ personId }: { personId: number }) {
  const t = useTranslations('CoherenceTab');
  const { person } = usePersonById({ id: personId });
  const name = [person?.name, person?.surname]
    .filter((part) => part?.trim())
    .join(' ')
    .trim();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PersonAvatar
        size="sm"
        shape="circle"
        avatarSrc={person?.avatarUrl ?? ''}
        userName={name || undefined}
        personId={personId}
      />
      <span className="truncate text-1 text-foreground">
        {name || t('signalCreatorUnknown')}
      </span>
    </span>
  );
}

function ColumnLabel({
  columns,
  columnKey,
}: {
  columns: SignalLaneColumns;
  columnKey: string;
}) {
  const t = useTranslations('CoherenceTab');
  if (columns === 'type') return <SignalTypeBadge type={columnKey} />;
  if (columns === 'creator') {
    return columnKey === UNKNOWN_CREATOR_COLUMN ? (
      <span className="truncate text-1 text-muted-foreground">
        {t('signalCreatorUnknown')}
      </span>
    ) : (
      <CreatorColumnLabel personId={Number(columnKey)} />
    );
  }
  return null;
}

/**
 * Swimlanes on the Signals tab (#2765, #2763 D6): one row per board, and
 * optionally one column per type or per creator. Dragging moves a signal to
 * another row (board) only; columns are read-only.
 */
export function SignalSwimlanes({
  lanes,
  columns,
  spaceSlug,
  renderSignal,
  onMoveToBoard,
}: SignalSwimlanesProps) {
  const t = useTranslations('CoherenceTab');
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const draggingRef = React.useRef<Coherence | null>(null);
  const canMove = Boolean(onMoveToBoard) && lanes.length > 1;

  // Read after mount so server and first client render agree.
  React.useEffect(() => {
    setCollapsed(readCollapsedSignalLanes(spaceSlug));
  }, [spaceSlug]);

  const toggleLane = React.useCallback(
    (slug: string) => {
      setCollapsed((current) => {
        const next = toggleCollapsedSignalLane(current, slug);
        writeCollapsedSignalLanes(spaceSlug, next);
        return next;
      });
    },
    [spaceSlug],
  );

  const findSignal = React.useCallback(
    (slug: string | null) => {
      if (!slug) return null;
      for (const lane of lanes) {
        for (const column of lane.columns) {
          const match = column.signals.find((item) => item.slug === slug);
          if (match) return match;
        }
      }
      return null;
    },
    [lanes],
  );

  const endDrag = React.useCallback(() => {
    draggingRef.current = null;
    setDropTarget(null);
  }, []);

  const hasColumns = columns !== 'none';

  return (
    <div data-testid="signal-swimlanes" className="flex w-full flex-col gap-3">
      {lanes.map((lane) => {
        const slug = lane.board.slug;
        const isCollapsed = collapsed.includes(slug);
        const bodyId = `signal-lane-${slug}`;
        const isDropTarget = canMove && dropTarget === slug;

        return (
          <section
            key={slug}
            data-testid="signal-lane"
            data-board={slug}
            className={cn(
              'craft-card flex w-full flex-col',
              isDropTarget && 'ring-1 ring-inset ring-foreground/40',
            )}
            onDragOver={
              canMove
                ? (event) => {
                    handleColumnDragOver(event);
                    setDropTarget(slug);
                  }
                : undefined
            }
            onDragLeave={
              canMove
                ? (event) => {
                    if (isDragLeaveColumn(event, event.currentTarget)) {
                      setDropTarget((current) =>
                        current === slug ? null : current,
                      );
                    }
                  }
                : undefined
            }
            onDrop={
              canMove
                ? (event) => {
                    event.preventDefault();
                    const signal = findSignal(
                      getSignalDragSlug(
                        event,
                        draggingRef.current?.slug ?? null,
                      ),
                    );
                    endDrag();
                    if (signal) onMoveToBoard?.(signal, slug);
                  }
                : undefined
            }
          >
            <header>
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={isCollapsed ? undefined : bodyId}
                title={
                  isCollapsed ? t('signalLaneExpand') : t('signalLaneCollapse')
                }
                onClick={() => toggleLane(slug)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <ChevronRight
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                      !isCollapsed && 'rotate-90',
                    )}
                    aria-hidden
                  />
                  <span
                    role="heading"
                    aria-level={2}
                    className="truncate text-2 font-medium text-foreground"
                  >
                    {lane.board.name}
                  </span>
                </span>
                <span className="shrink-0 text-1 tabular-nums text-muted-foreground">
                  {lane.count}
                </span>
              </button>
            </header>

            {isCollapsed ? null : (
              <div
                id={bodyId}
                className={cn(
                  'flex w-full gap-3 border-t border-border/50 p-3',
                  hasColumns && 'overflow-x-auto',
                )}
              >
                {lane.columns.map((column) => (
                  <div
                    key={column.key}
                    data-testid="signal-lane-column"
                    data-column={column.key}
                    className={cn(
                      'flex min-w-0 flex-col gap-2',
                      hasColumns ? 'w-[20rem] shrink-0' : 'flex-1',
                    )}
                  >
                    {hasColumns ? (
                      <div className="flex min-h-8 items-center justify-between gap-2 px-1">
                        <ColumnLabel columns={columns} columnKey={column.key} />
                        <span className="shrink-0 text-1 tabular-nums text-muted-foreground">
                          {column.signals.length}
                        </span>
                      </div>
                    ) : null}
                    {column.signals.map((signal) => (
                      <div
                        key={signal.id}
                        draggable={canMove && Boolean(signal.slug)}
                        onDragStart={
                          canMove
                            ? (event) => {
                                if (!signal.slug) return;
                                setSignalDragData(event, signal.slug);
                                draggingRef.current = signal;
                              }
                            : undefined
                        }
                        onDragEnd={canMove ? endDrag : undefined}
                      >
                        {renderSignal(signal)}
                      </div>
                    ))}
                    {column.signals.length === 0 ? (
                      <p className="m-0 px-1 py-4 text-center text-1 text-muted-foreground">
                        {t('signalLaneEmpty')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
