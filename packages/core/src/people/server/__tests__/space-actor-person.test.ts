import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hypha-platform/storage-postgres', () => ({
  people: { id: 'people.id', sub: 'people.sub' },
}));

import {
  ensureSpaceActorPerson,
  spaceActorSub,
  type SpaceActorSource,
} from '../space-actor-person';

const space: SpaceActorSource = {
  id: 5,
  slug: 'riverside',
  title: 'Riverside DAO',
  logoUrl: 'https://cdn.example.org/riverside.png',
};

type Row = Record<string, unknown> & { id: number };

/**
 * Minimal stand-in for the Drizzle chains this module uses. Predicates are
 * opaque, so `actors` holds only the space actor rows a select could match,
 * while `takenSlugs` models slugs owned by unrelated people.
 */
function createFakeDb() {
  const state = {
    actors: [] as Row[],
    takenSlugs: new Set<string>(),
    inserted: [] as Record<string, unknown>[],
    updated: [] as Record<string, unknown>[],
  };

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => state.actors.slice(0, 1) }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            state.inserted.push(values);
            if (state.takenSlugs.has(String(values.slug))) return [];
            const row: Row = { ...values, id: 900 + state.actors.length };
            state.actors.push(row);
            return [row];
          },
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            state.updated.push(values);
            const next = { ...state.actors[0], ...values } as Row;
            state.actors[0] = next;
            return [next];
          },
        }),
      }),
    }),
  };

  return { db: db as never, state };
}

let fake: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  fake = createFakeDb();
});

describe('ensureSpaceActorPerson', () => {
  it('creates a person that stands for the space', async () => {
    const actor = await ensureSpaceActorPerson({ space }, { db: fake.db });

    expect(actor.id).toBe(900);
    expect(fake.state.inserted).toHaveLength(1);
    expect(fake.state.inserted[0]).toMatchObject({
      sub: 'space:5',
      slug: 'space-riverside',
      name: 'Riverside DAO',
      avatarUrl: 'https://cdn.example.org/riverside.png',
    });
  });

  it('leaves the actor without a wallet or email, so it holds no voting power', async () => {
    await ensureSpaceActorPerson({ space }, { db: fake.db });

    const values = fake.state.inserted[0] ?? {};
    expect(values.address).toBeUndefined();
    expect(values.email).toBeUndefined();
  });

  it('cannot be signed in as, because its sub is not a Privy subject', () => {
    expect(spaceActorSub(5)).toBe('space:5');
    expect(spaceActorSub(5).startsWith('did:privy:')).toBe(false);
  });

  it('reuses the actor on later signals instead of creating another', async () => {
    const first = await ensureSpaceActorPerson({ space }, { db: fake.db });
    const second = await ensureSpaceActorPerson({ space }, { db: fake.db });

    expect(second.id).toBe(first.id);
    expect(fake.state.inserted).toHaveLength(1);
  });

  it('qualifies the slug with the space id when a member already holds it', async () => {
    fake.state.takenSlugs.add('space-riverside');

    const actor = await ensureSpaceActorPerson({ space }, { db: fake.db });

    expect(fake.state.inserted.map((values) => values.slug)).toEqual([
      'space-riverside',
      'space-riverside-5',
    ]);
    expect(actor.slug).toBe('space-riverside-5');
  });

  it('refreshes the label after the space is renamed', async () => {
    await ensureSpaceActorPerson({ space }, { db: fake.db });

    const actor = await ensureSpaceActorPerson(
      { space: { ...space, title: 'Riverside Collective' } },
      { db: fake.db },
    );

    expect(actor.name).toBe('Riverside Collective');
    expect(fake.state.updated).toHaveLength(1);
  });

  it('does not write when nothing about the space changed', async () => {
    await ensureSpaceActorPerson({ space }, { db: fake.db });
    await ensureSpaceActorPerson({ space }, { db: fake.db });

    expect(fake.state.updated).toHaveLength(0);
  });
});
