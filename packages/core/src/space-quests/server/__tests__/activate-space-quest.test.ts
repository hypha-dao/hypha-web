import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { people, spaceQuests } from '@hypha-platform/storage-postgres';
import { activateSpaceQuestByDocumentId } from '../mutations';

type QuestRow = {
  id: number;
  status: string;
  proposalDocumentId: number;
  chatRoomId: string;
  leadPersonId: number | null;
  leadName: string;
  name: string;
};

type PostRow = {
  questId: number;
  text: string;
  authorAvatarUrl?: string | null;
};

type PersonRow = { id: number; avatarUrl: string | null };

/**
 * In-memory stand-in for the neon-serverless transaction used in production.
 * Transactions run one at a time and commit only after the callback returns,
 * matching a proposed-row UPDATE that loses to a concurrent claim.
 */
function createActivationDb(initial: QuestRow[], peopleRows: PersonRow[] = []) {
  let quests = initial.map((row) => ({ ...row }));
  let posts: PostRow[] = [];
  let rollbacks = 0;
  let failInsert = false;
  let tail: Promise<void> = Promise.resolve();

  function sqlValues(node: unknown, out: unknown[] = []): unknown[] {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
      for (const item of node) sqlValues(item, out);
      return out;
    }
    const record = node as {
      value?: unknown;
      encoder?: unknown;
      queryChunks?: unknown[];
    };
    if ('value' in record && 'encoder' in record) {
      out.push(record.value);
      return out;
    }
    if (Array.isArray(record.queryChunks)) sqlValues(record.queryChunks, out);
    return out;
  }

  function transactionClient(snapshot: QuestRow[], postSnapshot: PostRow[]) {
    return {
      update() {
        return {
          set(patch: Partial<QuestRow>) {
            return {
              where(filter: unknown) {
                return {
                  returning() {
                    const values = sqlValues(filter);
                    const id = values.find(
                      (value) => typeof value === 'number',
                    );
                    const requiresProposed = values.includes('proposed');
                    if (!requiresProposed || typeof id !== 'number') {
                      return Promise.resolve([]);
                    }
                    const row = snapshot.find(
                      (item) => item.id === id && item.status === 'proposed',
                    );
                    if (!row) return Promise.resolve([]);
                    Object.assign(row, patch);
                    return Promise.resolve([{ ...row }]);
                  },
                };
              },
            };
          },
        };
      },
      insert() {
        return {
          values(row: PostRow) {
            if (failInsert) throw new Error('acceptance post failed');
            postSnapshot.push({ ...row });
            return Promise.resolve();
          },
        };
      },
    };
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              const rows =
                table === spaceQuests
                  ? quests.map((row) => ({ ...row }))
                  : table === people
                  ? peopleRows.map((row) => ({ ...row }))
                  : [];
              const promise = Promise.resolve(rows);
              return Object.assign(promise, {
                limit(count: number) {
                  return Promise.resolve(rows.slice(0, count));
                },
              });
            },
          };
        },
      };
    },
    transaction<T>(
      fn: (tx: ReturnType<typeof transactionClient>) => Promise<T>,
    ) {
      const run = tail.then(async () => {
        const snapshot = quests.map((row) => ({ ...row }));
        const postSnapshot = posts.map((row) => ({ ...row }));
        try {
          const result = await fn(transactionClient(snapshot, postSnapshot));
          quests = snapshot;
          posts = postSnapshot;
          return result;
        } catch (error) {
          rollbacks += 1;
          throw error;
        }
      });
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  return {
    db: db as never,
    posts: () => posts.map((row) => ({ ...row })),
    quests: () => quests.map((row) => ({ ...row })),
    rollbacks: () => rollbacks,
    failNextInsert() {
      failInsert = true;
    },
  };
}

function proposedQuest(): QuestRow {
  return {
    id: 4,
    status: 'proposed',
    proposalDocumentId: 9,
    chatRoomId: '!quest:example.org',
    leadPersonId: 7,
    leadName: 'Ada Lovelace',
    name: 'Onboarding matcher',
  };
}

describe('activateSpaceQuestByDocumentId', () => {
  it('claims a proposed quest once and posts only inside the successful transaction', async () => {
    const store = createActivationDb([proposedQuest()]);
    const first = await activateSpaceQuestByDocumentId(
      { documentId: 9 },
      { db: store.db },
    );
    const second = await activateSpaceQuestByDocumentId(
      { documentId: 9 },
      { db: store.db },
    );

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(store.quests()[0]?.status).toBe('active');
    expect(store.posts()).toEqual([
      expect.objectContaining({
        questId: 4,
        text: 'Quest proposal accepted — Quest is now Active.',
      }),
    ]);
    expect(store.rollbacks()).toBe(0);
  });

  it('uses the lead avatar on the acceptance post when the person has one', async () => {
    const store = createActivationDb(
      [proposedQuest()],
      [{ id: 7, avatarUrl: 'https://example.com/ada.png' }],
    );
    await activateSpaceQuestByDocumentId({ documentId: 9 }, { db: store.db });
    expect(store.posts()[0]).toEqual(
      expect.objectContaining({
        text: 'Quest proposal accepted — Quest is now Active.',
        authorAvatarUrl: 'https://example.com/ada.png',
      }),
    );
  });

  it('leaves the acceptance avatar empty when the lead has none', async () => {
    const store = createActivationDb(
      [proposedQuest()],
      [{ id: 7, avatarUrl: null }],
    );
    await activateSpaceQuestByDocumentId({ documentId: 9 }, { db: store.db });
    expect(store.posts()[0]?.authorAvatarUrl).toBeNull();
  });

  it('lets one of two overlapping activations claim the proposed row', async () => {
    const store = createActivationDb([proposedQuest()]);
    const [left, right] = await Promise.all([
      activateSpaceQuestByDocumentId({ documentId: 9 }, { db: store.db }),
      activateSpaceQuestByDocumentId({ documentId: 9 }, { db: store.db }),
    ]);

    expect([left, right].sort()).toEqual([0, 1]);
    expect(store.quests()[0]?.status).toBe('active');
    expect(store.posts()).toHaveLength(1);
  });

  it('rolls the status change back when the acceptance post fails', async () => {
    const store = createActivationDb([proposedQuest()]);
    store.failNextInsert();

    await expect(
      activateSpaceQuestByDocumentId({ documentId: 9 }, { db: store.db }),
    ).rejects.toThrow('acceptance post failed');

    expect(store.quests()[0]?.status).toBe('proposed');
    expect(store.posts()).toEqual([]);
    expect(store.rollbacks()).toBe(1);
  });
});
