'use client';

import React from 'react';
import { isValid } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { Coherence, SignalWorkflowConfig } from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';
import { SignalCardActions } from './signal-card-actions';
import { SignalCreatorMeta } from './signal-creator-meta';
import { SignalTagBadges } from './signal-tag-badges';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import { priorityLeftBorderEdgeClass } from '../utils/signal-priority-styles';
import { isSignalDueOverdue } from '../utils/signal-due-date';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import {
  isSignalSlugActive,
  signalCardActiveClass,
} from '../utils/signal-active-styles';
import { resolveEffectiveBoard } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { usePersonById } from '@hypha-platform/core/client';

type SignalListViewProps = {
  signals: Coherence[];
  workflow: SignalWorkflowConfig;
  onSignalClick?: (signal: Coherence) => void;
  activeSignalSlug?: string | null;
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

function ListAssigneeStack({
  assigneeIds,
  className,
}: {
  assigneeIds: number[];
  className?: string;
}) {
  const visible = assigneeIds.slice(0, 2);
  return (
    <div className={cn('flex -space-x-1', className)}>
      {visible.map((id) => (
        <ListAssigneeAvatar key={id} personId={id} />
      ))}
      {assigneeIds.length > 2 ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
          +{assigneeIds.length - 2}
        </span>
      ) : null}
    </div>
  );
}

function ListAssigneeAvatar({ personId }: { personId: number }) {
  const { person } = usePersonById({ id: personId });
  const label =
    [person?.name, person?.surname].filter(Boolean).join(' ').trim() ||
    person?.nickname ||
    '?';
  return (
    <PersonAvatar
      size="sm"
      avatarSrc={person?.avatarUrl || ''}
      userName={label}
      className="ring-2 ring-background"
    />
  );
}

function SignalListCreatorMeta({ signal }: { signal: Coherence }) {
  const { creatorDisplayName, createdAtRelative } = useSignalCreatorMeta({
    creatorId: signal.creatorId,
    createdAt: signal.createdAt,
    description: signal.description,
    title: signal.title,
    tags: signal.tags,
  });

  return (
    <SignalCreatorMeta
      creatorDisplayName={creatorDisplayName}
      createdAtRelative={createdAtRelative}
      className="mt-0.5"
    />
  );
}

/** Shared desktop list grid — title flexes; metadata columns stay compact but readable. */
const SIGNAL_LIST_GRID_CLASS =
  'lg:grid-cols-[minmax(0,2.35fr)_minmax(7rem,8.25rem)_5.25rem_4.5rem_minmax(8.5rem,10.5rem)_3.5rem] lg:gap-2';

export function SignalListView({
  signals,
  workflow,
  onSignalClick,
  activeSignalSlug,
  onPatch,
  refresh,
  readOnly = false,
}: SignalListViewProps) {
  const t = useTranslations('CoherenceTab');
  const intlFormat = useFormatter();

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div
        className={cn(
          'hidden gap-2 border-b border-border/40 bg-muted/20 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid',
          SIGNAL_LIST_GRID_CLASS,
        )}
      >
        <span>{t('signalListTitle')}</span>
        <span>{t('signalListStatus')}</span>
        <span>{t('signalListDue')}</span>
        <span>{t('signalListPriority')}</span>
        <span>{t('signalListBoard')}</span>
        <span className="text-right">{t('signalListActions')}</span>
      </div>

      <ul className="divide-y divide-border/40">
        {signals.map((signal) => {
          const dueDate =
            signal.dueAt instanceof Date
              ? signal.dueAt
              : signal.dueAt
              ? new Date(signal.dueAt)
              : null;
          const hasValidDue = dueDate != null && isValid(dueDate);
          const isOverdue = hasValidDue && isSignalDueOverdue(dueDate);
          const statusName =
            workflow.statuses.find(
              (status) => status.slug === signal.progressStatus,
            )?.name ??
            signal.progressStatus ??
            '—';
          const boardName =
            workflow.boards.find(
              (board) =>
                board.slug === resolveEffectiveBoard(signal.board, workflow),
            )?.name ?? resolveEffectiveBoard(signal.board, workflow);
          const isActive = isSignalSlugActive(signal.slug, activeSignalSlug);

          return (
            <li
              key={signal.id}
              {...getSignalSlugDomProps(signal.slug)}
              className={cn(
                'group border-l-[3px] px-3 py-3 transition-[background-color,border-color,box-shadow] lg:px-4',
                priorityLeftBorderEdgeClass(signal.priority),
                signalCardActiveClass(isActive, 'rounded-none'),
                !isActive && 'hover:bg-muted/20',
              )}
            >
              <div
                className={cn(
                  'grid grid-cols-1 gap-3 lg:items-center',
                  SIGNAL_LIST_GRID_CLASS,
                )}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSignalClick?.(signal)}
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent-11">
                      {signal.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t(
                        `types.${signal.type}` as
                          | 'types.Opportunity'
                          | 'types.Risk'
                          | 'types.Tension'
                          | 'types.Insight'
                          | 'types.Trend'
                          | 'types.Proposal',
                      )}
                    </span>
                    <SignalTagBadges
                      tags={signal.tags}
                      maxVisible={3}
                      className="mt-1"
                    />
                    <SignalListCreatorMeta signal={signal} />
                  </button>
                  {signal.assigneeIds.length > 0 ? (
                    <ListAssigneeStack
                      assigneeIds={signal.assigneeIds}
                      className="hidden shrink-0 lg:flex"
                    />
                  ) : null}
                </div>

                <div className="lg:contents">
                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      {t('signalListStatus')}
                    </span>
                    {readOnly ? (
                      <span className="text-sm text-muted-foreground">
                        {statusName}
                      </span>
                    ) : (
                      <Select
                        value={
                          signal.progressStatus ?? workflow.statuses[0]?.slug
                        }
                        onValueChange={(value) =>
                          onPatch(signal, { progressStatus: value })
                        }
                      >
                        <SelectTrigger className="h-8 w-full min-w-0 truncate border-border/60 bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {workflow.statuses.map((status) => (
                            <SelectItem key={status.slug} value={status.slug}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      {t('signalListDue')}
                    </span>
                    {hasValidDue ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-sm',
                          isOverdue
                            ? 'font-medium text-error-11'
                            : 'text-muted-foreground',
                        )}
                      >
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {intlFormat.dateTime(dueDate, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 lg:block">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      {t('signalListPriority')}
                    </span>
                    <span className="truncate text-sm capitalize text-muted-foreground">
                      {signal.priority}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 lg:min-w-0 lg:block">
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      {t('signalListBoard')}
                    </span>
                    {readOnly ? (
                      <span className="truncate text-sm text-muted-foreground">
                        {boardName}
                      </span>
                    ) : (
                      <Select
                        value={resolveEffectiveBoard(signal.board, workflow)}
                        onValueChange={(value) =>
                          onPatch(signal, {
                            board: value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-full min-w-0 truncate border-border/60 bg-background/80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {workflow.boards
                            .filter((board) => !board.archived)
                            .map((board) => (
                              <SelectItem key={board.slug} value={board.slug}>
                                {board.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 lg:col-start-6 lg:justify-end">
                    {signal.assigneeIds.length > 0 ? (
                      <ListAssigneeStack
                        assigneeIds={signal.assigneeIds}
                        className="lg:hidden"
                      />
                    ) : (
                      <span className="lg:hidden" />
                    )}
                    <SignalCardActions
                      signal={signal}
                      refresh={refresh}
                      className="shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
