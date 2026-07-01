'use client';

import React from 'react';
import { format } from 'date-fns';
import { Coherence, SignalWorkflowConfig } from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

type SignalListViewProps = {
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

export function SignalListView({
  signals,
  workflow,
  onSignalClick,
  onPatch,
  readOnly = false,
}: SignalListViewProps) {
  const t = useTranslations('CoherenceTab');

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t('signalListTitle')}</th>
            <th className="px-3 py-2 font-medium">{t('signalListStatus')}</th>
            <th className="px-3 py-2 font-medium">{t('signalListDue')}</th>
            <th className="px-3 py-2 font-medium">{t('signalListPriority')}</th>
            <th className="px-3 py-2 font-medium">{t('signalListBoard')}</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr
              key={signal.id}
              className="border-b border-border/40 hover:bg-muted/20"
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-left font-medium hover:text-accent-11"
                  onClick={() => onSignalClick?.(signal)}
                >
                  {signal.title}
                </button>
              </td>
              <td className="px-3 py-2">
                {readOnly ? (
                  <span className="text-muted-foreground">
                    {workflow.statuses.find(
                      (status) => status.slug === signal.progressStatus,
                    )?.name ??
                      signal.progressStatus ??
                      '—'}
                  </span>
                ) : (
                  <Select
                    value={signal.progressStatus ?? workflow.statuses[0]?.slug}
                    onValueChange={(value) =>
                      onPatch(signal, { progressStatus: value })
                    }
                  >
                    <SelectTrigger className="h-8 w-[9rem]">
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
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {signal.dueAt ? format(signal.dueAt, 'MMM d, yyyy') : '—'}
              </td>
              <td className="px-3 py-2 capitalize text-muted-foreground">
                {signal.priority}
              </td>
              <td className="px-3 py-2">
                {readOnly ? (
                  <span className="text-muted-foreground">
                    {workflow.boards.find(
                      (board) => board.slug === signal.board,
                    )?.name ?? t('signalBoardUncategorized')}
                  </span>
                ) : (
                  <Select
                    value={signal.board ?? '__none__'}
                    onValueChange={(value) =>
                      onPatch(signal, {
                        board: value === '__none__' ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[9rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t('signalBoardUncategorized')}
                      </SelectItem>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
