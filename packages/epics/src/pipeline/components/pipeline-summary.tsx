'use client';

import type { Deal, ProbabilityMatrix } from '@hypha-platform/core/client';
import {
  effectiveSuccessRate,
  PIPELINE_SWIMLANES,
} from '@hypha-platform/core/client';
import { useFormatter, useTranslations } from 'next-intl';

type PipelineSummaryProps = {
  deals: Deal[];
  probabilities?: ProbabilityMatrix;
};

type CurrencyTotals = { total: number; weighted: number };

export function PipelineSummary({
  deals,
  probabilities,
}: PipelineSummaryProps) {
  const t = useTranslations('Pipeline');
  const format = useFormatter();
  const active = deals.filter(
    (d) => d.pipelineStatus !== 'Won' && d.pipelineStatus !== 'Lost',
  );

  // Deals can carry different currencies; never sum across currencies.
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const deal of active) {
    const currency = deal.currency || '€';
    const totals = byCurrency.get(currency) ?? { total: 0, weighted: 0 };
    totals.total += deal.value;
    totals.weighted +=
      (deal.value * effectiveSuccessRate(deal, probabilities)) / 100;
    byCurrency.set(currency, totals);
  }

  const formatTotals = (pick: (totals: CurrencyTotals) => number): string => {
    if (byCurrency.size === 0) return '€0';
    return [...byCurrency.entries()]
      .map(
        ([currency, totals]) =>
          `${currency}${format.number(pick(totals), {
            maximumFractionDigits: 0,
          })}`,
      )
      .join(' + ');
  };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryCard label={t('summary.deals')} value={String(deals.length)} />
      <SummaryCard label={t('summary.active')} value={String(active.length)} />
      <SummaryCard
        label={t('summary.pipelineValue')}
        value={formatTotals((totals) => totals.total)}
      />
      <SummaryCard
        label={t('summary.weightedValue')}
        value={formatTotals((totals) => totals.weighted)}
      />
      <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2 text-1 text-neutral-11">
        {PIPELINE_SWIMLANES.map((swimlane) => {
          const count = deals.filter(
            (d) => d.pipelineSwimlane === swimlane,
          ).length;
          return (
            <span
              key={swimlane}
              className="rounded-md border border-neutral-5 px-2 py-1"
            >
              {swimlane}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-5 bg-neutral-1 px-3 py-2">
      <div className="text-1 text-neutral-11">{label}</div>
      <div className="text-3 font-medium text-neutral-12">{value}</div>
    </div>
  );
}
