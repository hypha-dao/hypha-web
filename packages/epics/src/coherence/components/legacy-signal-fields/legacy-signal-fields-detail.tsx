'use client';

import React from 'react';
import { CalendarDays, Globe2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { CAPITAL_MARK } from '../../../network-exchange/capital-marks';
import { SignalIndicativeAmounts } from '../signal-indicative-amounts';
import { SignalTagBadges } from '../signal-tag-badges';
import {
  PRIORITY_DOT_MARK_CLASS,
  priorityDotClass,
} from '../../utils/signal-priority-styles';
import {
  legacySignalFieldsToShow,
  type LegacySignalFieldSource,
} from './legacy-signal-fields';

/**
 * TODO: Temporary for Reciprocal Exchange. Delete this folder, and the
 * insertion points in `create-signal-form.tsx` and `signal-page.tsx`, when
 * Reciprocal Exchange no longer reads these columns.
 *
 * Renders nothing when every legacy field is still at its empty default, so
 * the detail page keeps its current spacing.
 */
export function LegacySignalFieldsDetail({
  signal,
}: {
  signal: LegacySignalFieldSource;
}) {
  const shown = legacySignalFieldsToShow(signal);
  const t = useTranslations('CoherenceTab');
  const tCard = useTranslations('SignalCard');
  const tExchange = useTranslations('NetworkExchange');
  const format = useFormatter();
  if (!shown) return null;

  const priorityLabel = shown.priority
    ? t.has(`priorities.${shown.priority}` as never)
      ? t(`priorities.${shown.priority}` as never)
      : shown.priority
    : null;

  return (
    <section
      data-testid="legacy-signal-fields"
      className="flex flex-wrap items-center gap-1.5"
    >
      {shown.sharedWithNetwork ? (
        <span
          className="inline-flex size-6 items-center justify-center border border-border text-muted-foreground"
          title={tCard('sharedWithNetwork')}
          aria-label={tCard('sharedWithNetwork')}
        >
          <Globe2 className="size-3.5" strokeWidth={1.25} aria-hidden />
        </span>
      ) : null}
      {shown.capitals.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-1 text-neutral-11"
        >
          <span aria-hidden>{CAPITAL_MARK[key]}</span>
          {tExchange(`capitals.${key}`)}
        </span>
      ))}
      {shown.priority && priorityLabel ? (
        <span className="inline-flex items-center gap-1.5 text-1 text-muted-foreground">
          <span
            className={cn(
              PRIORITY_DOT_MARK_CLASS,
              priorityDotClass(shown.priority),
            )}
            title={priorityLabel}
            aria-label={priorityLabel}
          />
          {priorityLabel}
        </span>
      ) : null}
      {shown.tags.length > 0 ? (
        <SignalTagBadges
          tags={shown.tags}
          maxVisible={shown.tags.length}
          showHashPrefix={false}
        />
      ) : null}
      {shown.dueAt ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
          {format.dateTime(shown.dueAt, { month: 'short', day: 'numeric' })}
        </span>
      ) : null}
      {shown.indicativePayouts.length > 0 ? (
        <SignalIndicativeAmounts payouts={shown.indicativePayouts} />
      ) : null}
    </section>
  );
}
