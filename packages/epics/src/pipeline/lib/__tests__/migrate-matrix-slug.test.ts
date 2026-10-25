import { describe, expect, it } from 'vitest';
import { migrateMatrixSlug } from '../migrate-matrix-slug';

describe('migrateMatrixSlug', () => {
  it('moves a placeholder cell and drops the old slug so a later new_stage is not reused', () => {
    const matrix = {
      Sales: { Identified: 5, new_stage: 42 },
    };

    const next = migrateMatrixSlug(
      matrix,
      [{ slug: 'Sales' }],
      'new_stage',
      'Won',
      () => 0,
    );

    expect(next.Sales?.Identified).toBe(5);
    expect(next.Sales?.Won).toBe(42);
    expect(next.Sales).not.toHaveProperty('new_stage');
  });
});
