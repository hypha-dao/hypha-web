'use client';

import React from 'react';
import { CalendarDays, Globe2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
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

/** Same heading treatment as the Description card on the signal page. */
const SECTION_LABEL_CLASS =
  'm-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground';

/**
 * TODO: Temporary for Reciprocal Exchange. Delete this folder, and the
 * insertion points in `create-signal-form.tsx` and `signal-page.tsx`, when
 * Reciprocal Exchange no longer reads these columns.
 *
 * Renders nothing when every legacy field is still at its empty default.
 * The page inserts this after the other detail sections, so an empty signal
 * keeps the current layout.
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
      className="craft-card flex flex-col gap-5 p-5"
    >
      {shown.sharedWithNetwork ? (
        <LegacyField label={t('shareWithNetwork')}>
          <span
            className="inline-flex size-6 items-center justify-center border border-border text-muted-foreground"
            title={tCard('sharedWithNetwork')}
            aria-label={tCard('sharedWithNetwork')}
          >
            <Globe2 className="size-3.5" strokeWidth={1.25} aria-hidden />
          </span>
        </LegacyField>
      ) : null}
      {shown.capitals.length > 0 ? (
        <LegacyField label={tExchange('formsOfCapital')}>
          <span className="flex flex-wrap gap-1">
            {shown.capitals.map((key) => (
              <span
                key={key}
                className="border border-foreground bg-foreground px-2 py-1 text-1 text-background"
              >
                {tExchange(`capitals.${key}`)}
              </span>
            ))}
          </span>
        </LegacyField>
      ) : null}
      {shown.priority && priorityLabel ? (
        <LegacyField label={t('priority')}>
          <span className="inline-flex items-center gap-1.5 text-1 text-foreground">
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
        </LegacyField>
      ) : null}
      {shown.tags.length > 0 ? (
        <LegacyField label={t('tags')}>
          <SignalTagBadges
            tags={shown.tags}
            maxVisible={shown.tags.length}
            showHashPrefix={false}
          />
        </LegacyField>
      ) : null}
      {shown.dueAt ? (
        <LegacyField label={t('signalFormDueDate')}>
          <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
            {format.dateTime(shown.dueAt, { month: 'short', day: 'numeric' })}
          </span>
        </LegacyField>
      ) : null}
      {shown.indicativePayouts.length > 0 ? (
        <LegacyField label={t('indicativeTokens')}>
          <SignalIndicativeAmounts payouts={shown.indicativePayouts} />
        </LegacyField>
      ) : null}
    </section>
  );
}

function LegacyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className={SECTION_LABEL_CLASS}>{label}</h2>
      {children}
    </div>
  );
}
