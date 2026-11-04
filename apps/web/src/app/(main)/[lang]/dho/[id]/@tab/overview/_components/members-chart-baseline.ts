export type MembersMonthlyPoint = {
  month: string;
  people: number;
  spaces: number;
};

/** Previous calendar month key (`YYYY-MM`), or null if the input is invalid. */
export function previousMonthKey(monthKey: string): string | null {
  const [year, month] = monthKey.split('-').map((part) => Number(part));
  if (!year || !month) return null;
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
}

/**
 * D3 line paths need ≥2 points. When the API returns a single cumulative
 * month, prepend a zero baseline for the prior month so a segment draws
 * without inventing a longer fake history.
 */
export function withMembersChartBaseline(
  monthly: MembersMonthlyPoint[],
): MembersMonthlyPoint[] {
  if (monthly.length !== 1) return monthly;
  const only = monthly[0]!;
  const baselineMonth = previousMonthKey(only.month);
  if (!baselineMonth) return monthly;
  return [{ month: baselineMonth, people: 0, spaces: 0 }, only];
}
