'use client';

import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { cn } from '@hypha-platform/ui-utils';
import type { ThreadSummaryPayload } from './use-thread-summary';

type HumanChatPanelThreadSummaryProps = {
  summary: ThreadSummaryPayload | null;
  isLoading?: boolean;
  threadTitle?: string | null;
  className?: string;
};

function formatUpdatedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function HumanChatPanelThreadSummary({
  summary,
  isLoading = false,
  threadTitle,
  className,
}: HumanChatPanelThreadSummaryProps) {
  const t = useTranslations('HumanChatPanel');
  const [expanded, setExpanded] = useState(true);
  const updatedLabel = useMemo(
    () =>
      formatUpdatedAt(summary?.lastRefreshedAt ?? summary?.updatedAt ?? null),
    [summary?.lastRefreshedAt, summary?.updatedAt],
  );

  if (isLoading && !summary?.summary?.trim()) {
    return (
      <div
        className={cn(
          'border-b border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground',
          className,
        )}
      >
        {t('threadSummaryLoading')}
      </div>
    );
  }

  if (!summary?.summary?.trim()) return null;

  return (
    <section
      className={cn(
        'border-b border-border/60 bg-muted/20 px-3 py-2',
        className,
      )}
      aria-label={t('threadSummaryLabel')}
    >
      <div className="flex items-start gap-2">
        <Sparkles
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">
                {t('threadSummaryTitle')}
                {threadTitle?.trim() ? (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {threadTitle.trim()}
                  </span>
                ) : null}
              </p>
              {updatedLabel ? (
                <p className="text-[11px] text-muted-foreground">
                  {t('threadSummaryUpdated', { when: updatedLabel })}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              aria-expanded={expanded}
              aria-label={
                expanded ? t('threadSummaryCollapse') : t('threadSummaryExpand')
              }
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {expanded ? (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-xs leading-relaxed text-foreground/90">
                {summary.summary}
              </p>
              {summary.bullets.length > 0 ? (
                <ul className="list-disc space-y-0.5 ps-4 text-xs text-foreground/85">
                  {summary.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
