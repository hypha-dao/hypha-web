import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@hypha-platform/storage-postgres', () => ({
  people: {},
  memberships: {},
  spaces: {},
  documents: {},
}));

import { mapToDomainPerson } from '../queries';

describe('mapToDomainPerson', () => {
  const row = {
    id: 7,
    slug: 'ada',
    name: 'Ada',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  };

  it('defaults missing networkVisible to true so login works pre-0077', () => {
    expect(mapToDomainPerson(row).networkVisible).toBe(true);
    expect(
      mapToDomainPerson({ ...row, networkVisible: undefined }).networkVisible,
    ).toBe(true);
  });

  it('preserves an explicit opt-out', () => {
    expect(
      mapToDomainPerson({ ...row, networkVisible: false }).networkVisible,
    ).toBe(false);
  });
});
