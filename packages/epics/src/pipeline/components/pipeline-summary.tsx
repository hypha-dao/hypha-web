'use client';

import type { Deal } from '@hypha-platform/core/client';
import {
  getDealProbability,
  PIPELINE_SWIMLANES,
} from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';

type PipelineSummaryProps = {
  deals: Deal[];
};

export function PipelineSummary({ deals }: PipelineSummaryProps) {
  const t = useTranslations('Pipeline');
  const active = deals.filter(
    (d) => d.pipelineStatus !== 'Won' && d.pipelineStatus !== 'Lost',
  );
  const totalValue = active.reduce((sum, d) => sum + d.value, 0);
  const weighted = active.reduce(
    (sum, d) =>
      sum +
      (d.value * getDealProbability(d.pipelineSwimlane, d.pipelineStatus)) /
        100,
    0,
  );
  const currency = deals[0]?.currency ?? '€';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryCard label={t('summary.deals')} value={String(deals.length)} />
      <SummaryCard label={t('summary.active')} value={String(active.length)} />
      <SummaryCard
        label={t('summary.pipelineValue')}
        value={`${currency}${totalValue.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}`}
      />
      <SummaryCard
        label={t('summary.weightedValue')}
        value={`${currency}${weighted.toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}`}
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
