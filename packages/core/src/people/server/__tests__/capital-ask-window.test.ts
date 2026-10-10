import { describe, expect, it } from 'vitest';

import { walkAccessibleCapitalAsks } from '../capital-ask-window';

function row(id: number, spaceId: number) {
  return { id, spaceId, createdAt: new Date(id * 1000) };
}

describe('walkAccessibleCapitalAsks', () => {
  it('keeps walking past a full page of inaccessible asks', async () => {
    const pages = [[row(10, 1), row(9, 1)], [row(8, 2)]];
    const result = await walkAccessibleCapitalAsks({
      limit: 1,
      pageSize: 2,
      pageBudget: 4,
      spaceCheckBudget: 4,
      loadPage: async () => pages.shift() ?? [],
      canAccessSpace: async (item) => item.spaceId === 2,
    });

    expect(result.rows.map((item) => item.id)).toEqual([8]);
    expect(result.complete).toBe(true);
  });

  it('stops when a new space would exceed the visibility budget', async () => {
    const result = await walkAccessibleCapitalAsks({
      limit: 2,
      pageSize: 3,
      pageBudget: 4,
      spaceCheckBudget: 1,
      loadPage: async () => [row(3, 1), row(2, 2)],
      canAccessSpace: async () => false,
    });

    expect(result.rows).toEqual([]);
    expect(result.complete).toBe(false);
  });

  it('reuses a space decision and does not count it twice', async () => {
    let checks = 0;
    const result = await walkAccessibleCapitalAsks({
      limit: 2,
      pageSize: 3,
      pageBudget: 2,
      spaceCheckBudget: 1,
      loadPage: async () => [row(5, 7), row(4, 7)],
      canAccessSpace: async () => {
        checks += 1;
        return true;
      },
    });

    expect(checks).toBe(1);
    expect(result.rows).toHaveLength(2);
    expect(result.complete).toBe(true);
  });
});
