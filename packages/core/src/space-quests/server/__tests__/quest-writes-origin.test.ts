import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const activeQuest = {
  id: 4,
  slug: 'garden',
  status: 'active',
  leadPersonId: 7,
  leadName: 'Ada Lovelace',
  members: [],
};

vi.mock('../queries', () => ({
  getSpaceQuestBySlug: vi.fn(async () => activeQuest),
}));
vi.mock('../../../space/server/queries', () => ({
  findSpaceBySlug: vi.fn(async () => ({ id: 3, slug: 'alpha' })),
}));
vi.mock('../../../space/server/get-space-members-roster', () => ({
  computeSpaceMemberEntries: vi.fn(async () => ({ found: true, entries: [] })),
}));
import {
  spaceQuests,
  spaceQuestUpdates,
} from '@hypha-platform/storage-postgres';
import { createSpaceQuest, postSpaceQuestUpdate } from '../mutations';
import { appOrigin, hyphaAssistantOrigin, type Origin } from '../../../origin';
import { schemaCreateSpaceQuest } from '../../validation';

/** Records every insert by table; selects return no rows. */
function captureDb() {
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    select: () => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
        for (const row of Array.isArray(values) ? values : [values]) {
          inserts.push({ table, values: row });
        }
        const first = Array.isArray(values) ? values[0] : values;
        return Object.assign(Promise.resolve(), {
          returning: async () => [
            { id: 4, slug: 'garden', status: 'proposed', ...first },
          ],
        });
      },
    }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve() }),
    }),
  };
  const rowsOf = (table: unknown) =>
    inserts.filter((entry) => entry.table === table).map((e) => e.values);
  return { db: db as never, rowsOf };
}

const actor = { id: 7, name: 'Ada Lovelace', avatarUrl: null };
const hostileKeys = {
  originKind: 'mcp_client',
  originClientId: 'evil',
  originClientLabel: 'Hypha',
  origin_kind: 'hypha_platform',
  viaAgent: true,
};

describe('quest writes carry the origin of the path, never one from input (#2724)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSpaceQuest writes the origin on the quest and its first update', async () => {
    const { db, rowsOf } = captureDb();
    const input = {
      ...schemaCreateSpaceQuest.parse({ name: 'Garden', leadPersonId: 7 }),
      ...hostileKeys,
    } as never;

    const result = await createSpaceQuest(
      { spaceSlug: 'alpha', input, actor },
      { db, origin: appOrigin() },
    );

    expect(result.ok).toBe(true);
    const [quest] = rowsOf(spaceQuests);
    const [update] = rowsOf(spaceQuestUpdates);
    for (const row of [quest, update]) {
      expect(row).toMatchObject({
        originKind: 'app',
        originClientId: null,
        originClientLabel: null,
      });
      expect(row).not.toHaveProperty('origin_kind');
      expect(row).not.toHaveProperty('viaAgent');
    }
  });

  it('postSpaceQuestUpdate writes the origin it is given', async () => {
    const { db, rowsOf } = captureDb();
    const result = await postSpaceQuestUpdate(
      {
        spaceSlug: 'alpha',
        questSlug: 'garden',
        input: {
          text: 'Dug the first bed',
          links: [],
          ...hostileKeys,
        } as never,
        actor,
      },
      { db, origin: hyphaAssistantOrigin() },
    );

    expect(result.ok).toBe(true);
    const [update] = rowsOf(spaceQuestUpdates);
    expect(update).toMatchObject({
      originKind: 'hypha_assistant',
      originClientId: null,
      originClientLabel: null,
    });
    expect(update).not.toHaveProperty('viaAgent');
  });

  it('refuses to write without a valid origin', async () => {
    const { db, rowsOf } = captureDb();
    const input = schemaCreateSpaceQuest.parse({
      name: 'Garden',
      leadPersonId: 7,
    });
    await expect(
      createSpaceQuest(
        { spaceSlug: 'alpha', input, actor },
        { db, origin: undefined as never },
      ),
    ).rejects.toThrow(/origin is required/);
    const forged = {
      kind: 'app',
      clientId: 'x',
      clientLabel: null,
    } as unknown as Origin;
    await expect(
      postSpaceQuestUpdate(
        {
          spaceSlug: 'alpha',
          questSlug: 'garden',
          input: { text: 'x', links: [] },
          actor,
        },
        { db, origin: forged },
      ),
    ).rejects.toThrow(/carries no client/);
    expect(rowsOf(spaceQuests)).toEqual([]);
    expect(rowsOf(spaceQuestUpdates)).toEqual([]);
  });
});
