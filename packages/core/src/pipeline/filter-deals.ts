import type { Deal, DealFilters } from './types';

function asArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value == null) return undefined;
  const list = Array.isArray(value) ? value : [value];
  // Treat an empty selection as "no filter" rather than rejecting everything.
  return list.length > 0 ? list : undefined;
}

export function filterDeals(deals: Deal[], filters: DealFilters = {}): Deal[] {
  const swimlanes = asArray(filters.swimlane);
  const regions = asArray(filters.region);
  const countryCodes = asArray(filters.country)
    ?.map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  const countries = countryCodes?.length ? countryCodes : undefined;
  const priorities = asArray(filters.priority);
  const statuses = asArray(filters.status);
  const pipelineStatuses = asArray(filters.pipelineStatus);
  const q = filters.q?.trim().toLowerCase();

  return deals.filter((deal) => {
    if (q) {
      const haystack = [
        deal.title,
        deal.notes ?? '',
        deal.nextAction ?? '',
        deal.region,
        deal.country ?? '',
        ...deal.tags,
        ...deal.contacts.map((c) =>
          [c.firstName, c.lastName, c.email].filter(Boolean).join(' '),
        ),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (swimlanes && !swimlanes.includes(deal.pipelineSwimlane)) return false;
    if (regions && !regions.includes(deal.region)) return false;
    if (
      countries &&
      !countries.includes((deal.country ?? '').trim().toUpperCase())
    ) {
      return false;
    }
    if (priorities && !priorities.includes(deal.priority)) return false;
    if (statuses && !statuses.includes(deal.status)) return false;
    if (pipelineStatuses && !pipelineStatuses.includes(deal.pipelineStatus)) {
      return false;
    }
    if (filters.ownerId != null && deal.ownerId !== filters.ownerId) {
      return false;
    }
    if (filters.tag) {
      const tag = filters.tag.toLowerCase();
      if (!deal.tags.some((t) => t.toLowerCase() === tag)) return false;
    }
    if (filters.hasDeadline === true && !deal.submissionDeadline) return false;
    if (filters.hasDeadline === false && deal.submissionDeadline) return false;
    return true;
  });
}
