'use client';

import type { Deal, ProbabilityMatrix } from '@hypha-platform/core/client';
import { effectiveSuccessRate } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter, useTranslations } from 'next-intl';
import { setDealDragData } from '../utils/deal-dnd-utils';

type DealCardProps = {
  deal: Deal;
  onClick?: (deal: Deal) => void;
  draggable?: boolean;
  active?: boolean;
  probabilities?: ProbabilityMatrix;
};

const priorityClass: Record<string, string> = {
  low: 'bg-neutral-4 text-neutral-11',
  medium: 'bg-accent-3 text-accent-11',
  high: 'bg-amber-3 text-amber-11',
  critical: 'bg-red-3 text-red-11',
};

export function DealCard({
  deal,
  onClick,
  draggable = true,
  active = false,
  probabilities,
}: DealCardProps) {
  const format = useFormatter();
  const t = useTranslations('Pipeline');
  const probability = effectiveSuccessRate(deal, probabilities);
  const weighted = (deal.value * probability) / 100;
  const isOverride = deal.successRate != null;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        setDealDragData(event, deal.id);
      }}
      onClick={() => onClick?.(deal)}
      className={cn(
        'w-full rounded-lg border border-neutral-6 bg-neutral-1 p-3 text-left shadow-sm transition hover:border-accent-8',
        active && 'border-accent-9 ring-1 ring-accent-8',
        deal.blocked && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2 font-medium text-neutral-12 line-clamp-2">
          {deal.title}
        </span>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase',
            priorityClass[deal.priority] ?? priorityClass.medium,
          )}
        >
          {deal.priority}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-1 text-neutral-11">
        <span>
          {deal.currency}
          {format.number(deal.value)}
        </span>
        <span>·</span>
        <span title={isOverride ? t('fields.successRateOverride') : undefined}>
          {probability}%{isOverride ? '*' : ''}
        </span>
        <span>·</span>
        <span>
          w {deal.currency}
          {format.number(weighted, { maximumFractionDigits: 0 })}
        </span>
      </div>
      {(deal.region || deal.country) && (
        <div className="mt-1 text-1 text-neutral-10">
          {[deal.country, deal.region].filter(Boolean).join(' · ')}
        </div>
      )}
      {deal.nextAction ? (
        <div className="mt-2 truncate text-1 text-neutral-11">
          → {deal.nextAction}
        </div>
      ) : null}
      {deal.blocked ? (
        <div className="mt-2 text-1 text-red-11">Blocked</div>
      ) : null}
    </button>
  );
}
