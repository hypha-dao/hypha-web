import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const storedRow = {
  id: 1,
  creatorId: 42,
  spaceId: null,
  slug: 'coh-1',
  type: 'Need',
  priority: 'medium',
  title: 't',
  description: 'd',
  archived: true,
  tags: [],
  assigneeIds: [],
  dueAt: null,
  originKind: 'space_key',
  originClientId: '3',
  originClientLabel: 'acaw-contest',
};

vi.mock('@hypha-platform/storage-postgres', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@hypha-platform/storage-postgres')
  >();
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => [storedRow],
  };
  return { ...actual, db: { select: () => chain } };
});
vi.mock('../../common/server/get-db', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('../../people/server/queries', () => ({
  findSelf: vi.fn(async () => ({ id: 42 })),
  findPersonsBySlug: vi.fn(async () => []),
}));
vi.mock('../server/assert-coherence-space-panel-auth', () => ({
  assertCoherenceSpacePanelAuth: vi.fn(async () => undefined),
}));
vi.mock('../server/mutations', () => ({
  updateCoherenceBySlug: vi.fn(async () => ({ ...storedRow })),
  patchCoherenceTaskBySlug: vi.fn(async () => ({ ...storedRow })),
  deleteCoherenceBySlug: vi.fn(async () => ({ ...storedRow })),
}));

import {
  deleteCoherenceBySlugAction,
  patchCoherenceTaskBySlugAction,
  updateCoherenceBySlugAction,
} from '../server/actions';

describe('signal action responses keep the origin client id on the server (#2724)', () => {
  it.each([
    [
      'update',
      () =>
        updateCoherenceBySlugAction(
          { slug: 'coh-1', archived: true },
          { authToken: 'token' },
        ),
    ],
    [
      'task patch',
      () =>
        patchCoherenceTaskBySlugAction(
          { slug: 'coh-1', progressStatus: 'done' },
          { authToken: 'token' },
        ),
    ],
    [
      'delete',
      () =>
        deleteCoherenceBySlugAction({ slug: 'coh-1' }, { authToken: 'token' }),
    ],
  ])('%s', async (_name, run) => {
    const result = await run();
    expect(result).not.toHaveProperty('originClientId');
    expect(result).not.toHaveProperty('originKind');
    expect(result.origin).toEqual({
      kind: 'space_key',
      clientLabel: 'acaw-contest',
    });
  });
});
