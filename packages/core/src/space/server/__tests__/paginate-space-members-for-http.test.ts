import { describe, expect, it } from 'vitest';
import { paginateSpaceMembersForHttp } from '../paginate-space-members-for-http';

describe('paginateSpaceMembersForHttp', () => {
  it('slices page 2 and reports totals', () => {
    const items = [1, 2, 3, 4, 5];
    const r = paginateSpaceMembersForHttp(items, 2, 2);
    expect(r.data).toEqual([3, 4]);
    expect(r.pagination.total).toBe(5);
    expect(r.pagination.page).toBe(2);
    expect(r.pagination.pageSize).toBe(2);
    expect(r.pagination.totalPages).toBe(3);
    expect(r.pagination.hasNextPage).toBe(true);
    expect(r.pagination.hasPreviousPage).toBe(true);
  });

  it('clamps pageSize and computes totals from clamped value', () => {
    const items = Array.from({ length: 250 }, (_, i) => i + 1);
    const r = paginateSpaceMembersForHttp(items, 1, 1000);
    expect(r.pagination.pageSize).toBe(100);
    expect(r.pagination.totalPages).toBe(3);
  });

  it('returns no prev/next pages when dataset is empty', () => {
    const r = paginateSpaceMembersForHttp([], 5, 10);
    expect(r.pagination.totalPages).toBe(0);
    expect(r.pagination.hasNextPage).toBe(false);
    expect(r.pagination.hasPreviousPage).toBe(false);
  });
});
