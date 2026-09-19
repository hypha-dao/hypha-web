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
};

export type NetworkPayingSnapshot = {
  currentlyPaying: number;
  everPaid: number;
  paymentEvents: number;
  paymentUsd: number;
  months: Array<{
    month: string;
    payingSpaces: number;
    paymentCount: number;
    paymentUsd: number;
  }>;
};

export const NETWORK_DASHBOARD_MONTHS = 12;

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

export function parseNetworkDashboardPayload(
  payload: unknown,
  options: {
    now?: Date;
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
    paymentCount?: number;
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
          paymentCount: asInt(item.paymentCount),
          paymentUsd: asFiniteNumber(item.paymentUsd),
        },
      ];
    }),
  };
}
