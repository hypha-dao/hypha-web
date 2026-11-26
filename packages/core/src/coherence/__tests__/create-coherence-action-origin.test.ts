import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

vi.mock('../../common/server/get-db', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('../../people/server/queries', () => ({
  findSelf: vi.fn(async () => ({ id: 42 })),
  findPersonsBySlug: vi.fn(async () => []),
}));
vi.mock('../server/mutations', () => ({
  createCoherence: vi.fn(async (input: Record<string, unknown>) => ({
    ...input,
    id: 1,
    spaceId: null,
    slug: 'coh-1',
    assigneeIds: [],
  })),
}));

import { createCoherenceAction } from '../server/actions';
import { createCoherence } from '../server/mutations';
import type { CreateCoherenceInput } from '../types';

describe('createCoherenceAction origin', () => {
  it('always writes the app origin, whatever the browser sends', async () => {
    const hostile = {
      creatorId: 7,
      spaceId: null,
      type: 'Need',
      priority: 'medium',
      title: 't',
      description: 'd',
      archived: false,
      tags: [],
      originKind: 'mcp_client',
      origin: { kind: 'hypha_intelligence', clientId: 'x', clientLabel: 'x' },
    } as unknown as CreateCoherenceInput;

    await createCoherenceAction(hostile, { authToken: 'token' });

    const [input, options] = vi.mocked(createCoherence).mock.calls[0]!;
    expect(options.origin).toMatchObject({
      kind: 'app',
      clientId: null,
      clientLabel: null,
    });
    // The signed-in person, not the one the browser named.
    expect(input.creatorId).toBe(42);
  });
});
