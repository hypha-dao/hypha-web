/**
 * Newest-first walk of investment asks.
 * Each distinct space costs an on-chain visibility read, so the walk stops
 * after a fixed number of those reads or a fixed number of full pages.
 * `complete` is false when that budget runs out before the candidates do.
 */
export const CAPITAL_ASK_PAGE_SIZE = 50;
export const CAPITAL_ASK_PAGE_BUDGET = 8;
export const CAPITAL_ASK_SPACE_CHECK_BUDGET = 12;

export type CapitalAskCursor = {
  createdAt: Date;
  id: number;
};

export async function walkAccessibleCapitalAsks<
  T extends { id: number; spaceId: number; createdAt: Date },
>(input: {
  limit: number;
  loadPage: (cursor: CapitalAskCursor | null) => Promise<T[]>;
  canAccessSpace: (row: T) => Promise<boolean>;
  pageSize?: number;
  pageBudget?: number;
  spaceCheckBudget?: number;
}): Promise<{ rows: T[]; complete: boolean }> {
  const pageSize = input.pageSize ?? CAPITAL_ASK_PAGE_SIZE;
  const pageBudget = input.pageBudget ?? CAPITAL_ASK_PAGE_BUDGET;
  const spaceCheckBudget =
    input.spaceCheckBudget ?? CAPITAL_ASK_SPACE_CHECK_BUDGET;
  const wanted = Math.min(Math.max(input.limit, 1), pageSize);
  const access = new Map<number, boolean>();
  const rows: T[] = [];
  let cursor: CapitalAskCursor | null = null;

  for (let pageIndex = 0; pageIndex < pageBudget; pageIndex += 1) {
    const page = await input.loadPage(cursor);
    if (page.length === 0) return { rows, complete: true };

    for (const row of page) {
      if (rows.length >= wanted) return { rows, complete: true };
      let allowed = access.get(row.spaceId);
      if (allowed === undefined) {
        if (access.size >= spaceCheckBudget) {
          return { rows, complete: false };
        }
        allowed = await input.canAccessSpace(row);
        access.set(row.spaceId, allowed);
      }
      if (allowed) rows.push(row);
    }

    const last = page[page.length - 1];
    if (!last || page.length < pageSize) return { rows, complete: true };
    cursor = { createdAt: last.createdAt, id: last.id };
  }

  return { rows, complete: false };
}
