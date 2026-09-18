export type NamedCount = {
  name: string;
  count: number;
};

export type MonthlyCount = {
  month: string;
  count: number;
};

export type NetworkDashboardStats = {
  spaceCount: number;
  activeSpaceCount: number;
  memberCount: number;
  proposalCount: number;
  spacesThisMonth: number;
  membersThisMonth: number;
  proposalsThisMonth: number;
  months: string[];
  spacesCumulative: number[];
  membersCumulative: number[];
  proposalsCumulative: number[];
  proposalsByType: NamedCount[];
};

export type NetworkPayingSnapshot = {
  currentlyPaying: number;
  everPaid: number;
  paymentEvents: number;
  paymentUsd: number;
  months: Array<{
    month: string;
    payingSpaces: number;
    paymentUsd: number;
  }>;
};

export const NETWORK_DASHBOARD_MONTHS = 12;
export const NETWORK_DASHBOARD_TOP_TYPES = 6;

export function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return 0;
}

export function asFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function utcMonthKeys(count: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, monthIndex - offset, 1));
    keys.push(
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        '0',
      )}`,
    );
  }
  return keys;
}

export function fillMonthlySeries(
  points: readonly MonthlyCount[],
  months: readonly string[],
): number[] {
  const byMonth = new Map<string, number>();
  for (const point of points) {
    byMonth.set(
      point.month,
      (byMonth.get(point.month) ?? 0) + asInt(point.count),
    );
  }
  return months.map((month) => byMonth.get(month) ?? 0);
}

export function toCumulativeSeries(
  counts: readonly number[],
  baseline = 0,
): number[] {
  let running = baseline;
  return counts.map((count) => {
    running += count;
    return running;
  });
}

export function mergeNamedCounts(
  items: readonly NamedCount[],
  canonicalize: (name: string) => string = (name) => name,
  limit = NETWORK_DASHBOARD_TOP_TYPES,
): NamedCount[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    const name = canonicalize(item.name).trim();
    if (!name) continue;
    merged.set(name, (merged.get(name) ?? 0) + asInt(item.count));
  }

  return [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseMonthlyCounts(value: unknown): MonthlyCount[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const month = String(record.month ?? '');
    if (!/^\d{4}-\d{2}$/.test(month)) return [];
    return [{ month, count: asInt(record.count) }];
  });
}

function parseNamedCounts(value: unknown): NamedCount[] {
  return asArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    const name = String(record.name ?? '').trim();
    if (!name) return [];
    return [{ name, count: asInt(record.count) }];
  });
}

export function parseNetworkDashboardPayload(
  payload: unknown,
  options: {
    now?: Date;
    canonicalizeProposalLabel?: (label: string) => string;
  } = {},
): NetworkDashboardStats {
  const record = asRecord(payload);
  const months = utcMonthKeys(NETWORK_DASHBOARD_MONTHS, options.now);
  const spacesByMonth = fillMonthlySeries(
    parseMonthlyCounts(record.spacesByMonth),
    months,
  );
  const membersByMonth = fillMonthlySeries(
    parseMonthlyCounts(record.membersByMonth),
    months,
  );
  const proposalsByMonth = fillMonthlySeries(
    parseMonthlyCounts(record.proposalsByMonth),
    months,
  );

  return {
    spaceCount: asInt(record.spaceCount),
    activeSpaceCount: asInt(record.activeSpaceCount),
    memberCount: asInt(record.memberCount),
    proposalCount: asInt(record.proposalCount),
    spacesThisMonth: spacesByMonth.at(-1) ?? 0,
    membersThisMonth: membersByMonth.at(-1) ?? 0,
    proposalsThisMonth: proposalsByMonth.at(-1) ?? 0,
    months,
    spacesCumulative: toCumulativeSeries(
      spacesByMonth,
      asInt(record.spacesBeforeWindow),
    ),
    membersCumulative: toCumulativeSeries(
      membersByMonth,
      asInt(record.membersBeforeWindow),
    ),
    proposalsCumulative: toCumulativeSeries(
      proposalsByMonth,
      asInt(record.proposalsBeforeWindow),
    ),
    proposalsByType: mergeNamedCounts(
      parseNamedCounts(record.proposalsByLabel),
      options.canonicalizeProposalLabel,
    ),
  };
}

export function toNetworkPayingSnapshot(data: {
  summary: {
    currentlyPaying: number;
    everPaid: number;
    paymentEvents: number;
    paymentUsd: number;
  };
  monthly: ReadonlyArray<{
    month: string;
    payingSpaces: number;
    paymentUsd: number;
  }>;
}): NetworkPayingSnapshot {
  return {
    currentlyPaying: asInt(data.summary.currentlyPaying),
    everPaid: asInt(data.summary.everPaid),
    paymentEvents: asInt(data.summary.paymentEvents),
    paymentUsd: asFiniteNumber(data.summary.paymentUsd),
    months: data.monthly.flatMap((item) => {
      const month = String(item.month ?? '');
      if (!/^\d{4}-\d{2}$/.test(month)) return [];
      return [
        {
          month,
          payingSpaces: asInt(item.payingSpaces),
          paymentUsd: asFiniteNumber(item.paymentUsd),
        },
      ];
    }),
  };
}
