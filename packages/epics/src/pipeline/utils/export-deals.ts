import type { Deal, ProbabilityMatrix } from '@hypha-platform/core/client';
import { effectiveSuccessRate } from '@hypha-platform/core/client';

export async function exportDealsToXlsx(
  deals: Deal[],
  filenamePrefix = 'deals',
  probabilities?: ProbabilityMatrix,
) {
  // xlsx is heavy — load it only when an export is actually triggered.
  const XLSX = await import('xlsx');
  const rows = deals.map((d) => ({
    Title: d.title,
    Swimlane: d.pipelineSwimlane,
    Status: d.pipelineStatus,
    Value: d.value,
    SuccessRatePct: effectiveSuccessRate(d, probabilities),
    WeightedValue:
      Math.round(d.value * effectiveSuccessRate(d, probabilities)) / 100,
    Currency: d.currency,
    Country: d.country ?? '',
    Region: d.region,
    Priority: d.priority,
    DealStatus: d.status,
    NextAction: d.nextAction ?? '',
    NextActionDate: d.nextActionDate ?? '',
    Deadline: d.submissionDeadline ?? '',
    OwnerId: d.ownerId,
    Tags: d.tags.join(', '),
    Notes: d.notes ?? '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Deals');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}
