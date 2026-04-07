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
});
