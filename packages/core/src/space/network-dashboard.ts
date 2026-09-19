import {
  convertToUsd,
  resolveReferenceCurrencyCode,
  type UsdRates,
} from '../common/web3/currency-conversion';

export type MonthlyCount = {
  month: string;
  count: number;
};

export type NetworkDashboardStats = {
  spaceCount: number;
  memberCount: number;
  proposalCount: number;
  transactionCount: number;
  spacesThisMonth: number;
  membersThisMonth: number;
  proposalsThisMonth: number;
  transactionsThisMonth: number;
  months: string[];
  spacesCumulative: number[];
  membersCumulative: number[];
  proposalsCumulative: number[];
  transactionsCumulative: number[];
};

export type NetworkTreasuryTokenUsd = {
  symbol: string;
  address: string;
  usd: number;
};

export type NetworkTreasurySnapshot = {
  aumUsd: number;
  treasuryCount: number;
  issuedTokenCount: number;
  transferCount: number;
  voteCount: number;
  transactionCount: number;
  transactionsThisMonth: number;
  months: string[];
  transactionsCumulative: number[];
  tokens: NetworkTreasuryTokenUsd[];
  generatedAt: string;
};

export type CombinedNetworkTransactions = {
  transactionCount: number;
  transactionsThisMonth: number;
  months: string[];
  transactionsCumulative: number[];
};

/**
 * Platform activity (documents, joins, executions, signal votes) plus
 * on-chain token transfers and proposal votes.
 */
export function combineNetworkTransactions(
  activity: Pick<
    NetworkDashboardStats,
    | 'transactionCount'
    | 'transactionsThisMonth'
    | 'transactionsCumulative'
    | 'months'
  >,
  chain?: Pick<
    NetworkTreasurySnapshot,
    | 'transferCount'
    | 'voteCount'
    | 'transactionCount'
    | 'transactionsThisMonth'
    | 'transactionsCumulative'
    | 'months'
  > | null,
): CombinedNetworkTransactions {
  const transferCount = asInt(chain?.transferCount);
  const voteCount = asInt(chain?.voteCount);
  const onChain =
    transferCount + voteCount > 0
      ? transferCount + voteCount
      : asInt(chain?.transactionCount);
  const months = activity.months;
  const chainMonths = chain?.months ?? [];
  const chainCumulative = chain?.transactionsCumulative ?? [];
  const mergedCumulative = activity.transactionsCumulative.map(
    (value, index) => {
      const chainMonth = chainMonths[index];
      const activityMonth = months[index];
      const chainValue =
        chainMonth && activityMonth && chainMonth === activityMonth
          ? asInt(chainCumulative[index])
          : 0;
      return value + chainValue;
    },
  );

  return {
    transactionCount: asInt(activity.transactionCount) + onChain,
    transactionsThisMonth:
      asInt(activity.transactionsThisMonth) +
      asInt(chain?.transactionsThisMonth),
    months,
    transactionsCumulative: mergedCumulative,
  };
}

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
  const transactionsByMonth = fillMonthlySeries(
    parseMonthlyCounts(record.transactionsByMonth),
    months,
  );

  return {
    spaceCount: asInt(record.spaceCount),
    memberCount: asInt(record.memberCount),
    proposalCount: asInt(record.proposalCount),
    transactionCount: asInt(record.transactionCount),
    spacesThisMonth: spacesByMonth.at(-1) ?? 0,
    membersThisMonth: membersByMonth.at(-1) ?? 0,
    proposalsThisMonth: proposalsByMonth.at(-1) ?? 0,
    transactionsThisMonth: transactionsByMonth.at(-1) ?? 0,
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
    transactionsCumulative: toCumulativeSeries(
      transactionsByMonth,
      asInt(record.transactionsBeforeWindow),
    ),
  };
}

export function parseNetworkTreasurySnapshot(
  payload: unknown,
  options: {
    now?: Date;
  } = {},
): NetworkTreasurySnapshot {
  const record = asRecord(payload);
  const months = utcMonthKeys(NETWORK_DASHBOARD_MONTHS, options.now);
  const transactionsByMonth = fillMonthlySeries(
    parseMonthlyCounts(record.transactionsByMonth),
    months,
  );
  const tokens = asArray(record.tokens).flatMap((entry) => {
    const token = asRecord(entry);
    const address = String(token.address ?? '');
    const symbol = String(token.symbol ?? '');
    if (!symbol && !address) return [];
    return [
      {
        symbol,
        address,
        usd: asFiniteNumber(token.usd),
      },
    ];
  });

  return {
    aumUsd: asFiniteNumber(record.aumUsd),
    treasuryCount: asInt(record.treasuryCount),
    issuedTokenCount: asInt(record.issuedTokenCount),
    transferCount: asInt(record.transferCount),
    voteCount: asInt(record.voteCount),
    transactionCount: asInt(record.transactionCount),
    transactionsThisMonth: transactionsByMonth.at(-1) ?? 0,
    months,
    transactionsCumulative: toCumulativeSeries(
      transactionsByMonth,
      asInt(record.transactionsBeforeWindow),
    ),
    tokens,
    generatedAt: String(record.generatedAt ?? ''),
  };
}

export function spaceIssuedTokenUsd(
  totalSupply: bigint,
  decimals: number,
  referencePrice: number,
  referenceCurrency: string | null | undefined,
  usdRates: UsdRates,
): number {
  if (!(referencePrice > 0)) return 0;
  const currency = resolveReferenceCurrencyCode(referenceCurrency) ?? 'USD';
  const usdPerUnit = convertToUsd(referencePrice, currency, usdRates);
  return tokenRawToUsd(totalSupply, decimals, usdPerUnit);
}

export function tokenRawToUsd(
  raw: bigint,
  decimals: number,
  usdPerUnit: number,
): number {
  if (raw <= 0n || decimals < 0 || decimals > 30 || !(usdPerUnit > 0)) {
    return 0;
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = Number(raw / divisor);
  const fraction = Number(raw % divisor) / Number(divisor);
  const units = whole + fraction;
  if (!Number.isFinite(units) || units <= 0) return 0;
  const usd = units * usdPerUnit;
  return Number.isFinite(usd) ? usd : 0;
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
