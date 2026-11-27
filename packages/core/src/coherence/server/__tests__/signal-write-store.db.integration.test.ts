import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Real-database check of signal creation for AI clients (#2744): the insert, its defaults, the
 * origin, and the duplicate rule under concurrency (the advisory lock). Runs only when a database
 * URL is set (`BRANCH_DB_URL` or `DEFAULT_DB_URL`); use a throwaway database that has run the
 * migrations. It creates its own rows (slugs prefixed `mcp-write-`) and deletes them afterwards.
 */
vi.mock('server-only', () => ({}));
vi.setConfig({ testTimeout: 90_000, hookTimeout: 400_000 });

const HAS_DB = Boolean(process.env.BRANCH_DB_URL || process.env.DEFAULT_DB_URL);
const PREFIX = `mcp-write-${Date.now()}`;

describe.skipIf(!HAS_DB)('signal write store (database)', () => {
  let db: typeof import('@hypha-platform/storage-postgres')['db'];
  let tables: typeof import('@hypha-platform/storage-postgres');
  let store: typeof import('../signal-write-store');
  let origins: typeof import('../../../origin');
  let sql: typeof import('drizzle-orm')['sql'];
  let eq: typeof import('drizzle-orm')['eq'];
  let spaceId: number;
  let person: number;

  const rule = (title: string, description: string) => ({
    fingerprint: `${PREFIX}:${title}:${description}`,
    windowSeconds: 600,
    sameContent: (row: { title: string; description: string }) =>
      row.title === title && row.description === description,
  });
  const signal = (title: string, description = 'Same text') => ({
    spaceId,
    creatorId: person,
    type: 'Need' as const,
    title,
    description,
    tags: ['water'],
  });
  const origin = (clientId = 'https://client.example/meta.json') =>
    origins.mcpClientOrigin({ clientId, clientName: 'Example AI' });

  beforeAll(async () => {
    store = await import('../signal-write-store');
    origins = await import('../../../origin');
    tables = await import('@hypha-platform/storage-postgres');
    db = tables.db;
    ({ sql, eq } = await import('drizzle-orm'));

    spaceId = (
      await db
        .insert(tables.spaces)
        .values({ title: PREFIX, slug: `${PREFIX}-space` } as never)
        .returning({ id: tables.spaces.id })
    )[0]!.id;
    person = (
      await db
        .insert(tables.people)
        .values({
          sub: `${PREFIX}-ada`,
          slug: `${PREFIX}-ada`,
          name: 'Ada',
          surname: 'Lovelace',
        } as never)
        .returning({ id: tables.people.id })
    )[0]!.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`delete from coherences where space_id = ${spaceId}`);
    await db.execute(sql`delete from spaces where id = ${spaceId}`);
    await db.execute(sql`delete from people where id = ${person}`);
  });

  it('writes the signal, the app defaults for legacy fields and the origin; nothing else', async () => {
    const r = await store.createSignalUnlessDuplicate(
      signal('First'),
      rule('First', 'Same text'),
      { db, origin: origin() },
    );
    expect(r.duplicate).toBe(false);
    expect(r.signal).toMatchObject({
      title: 'First',
      type: 'Need',
      tags: ['water'],
      origin: { kind: 'mcp_client', clientLabel: 'Example AI' },
    });
    expect(r.signal.slug).toMatch(/^coh-[0-9a-f]{8}$/);
    expect(r.signal).not.toHaveProperty('originClientId');

    const [row] = await db
      .select()
      .from(tables.coherences)
      .where(eq(tables.coherences.id, r.signal.id));
    expect(row).toMatchObject({
      spaceId,
      creatorId: person,
      archived: false,
      priority: 'medium',
      progressStatus: 'backlog',
      board: 'general',
      assigneeIds: [person],
      sharedWithNetwork: false,
      dueAt: null,
      source: null,
      externalId: null,
      originKind: 'mcp_client',
      originClientId: 'https://client.example/meta.json',
      originClientLabel: 'Example AI',
    });

    // The space's workflow config is read, never written.
    const [space] = await db
      .select({ signalWorkflow: tables.spaces.signalWorkflow })
      .from(tables.spaces)
      .where(eq(tables.spaces.id, spaceId));
    const stored = space?.signalWorkflow as object | null | undefined;
    expect(stored == null || Object.keys(stored).length === 0).toBe(true);
  });

  it('the same content again within the window returns the first signal', async () => {
    const first = await store.createSignalUnlessDuplicate(
      signal('Again'),
      rule('Again', 'Same text'),
      { db, origin: origin() },
    );
    const second = await store.createSignalUnlessDuplicate(
      signal('Again'),
      rule('Again', 'Same text'),
      { db, origin: origin() },
    );
    expect(second).toMatchObject({
      duplicate: true,
      signal: { id: first.signal.id },
    });
  });

  it('another client, other content, or an older signal is not a duplicate', async () => {
    const first = await store.createSignalUnlessDuplicate(
      signal('Window'),
      rule('Window', 'Same text'),
      { db, origin: origin() },
    );
    const otherClient = await store.createSignalUnlessDuplicate(
      signal('Window'),
      rule('Window', 'Same text'),
      { db, origin: origin('hypha-cursor') },
    );
    expect(otherClient.duplicate).toBe(false);

    const otherText = await store.createSignalUnlessDuplicate(
      signal('Window', 'Different text'),
      rule('Window', 'Different text'),
      { db, origin: origin() },
    );
    expect(otherText.duplicate).toBe(false);

    await db.execute(
      sql`update coherences set created_at = created_at - interval '11 minutes' where id = ${first.signal.id}`,
    );
    const later = await store.createSignalUnlessDuplicate(
      signal('Window'),
      rule('Window', 'Same text'),
      { db, origin: origin() },
    );
    expect(later.duplicate).toBe(false);
    expect(later.signal.id).not.toBe(first.signal.id);
  });

  it('identical calls at the same moment create one signal', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        store.createSignalUnlessDuplicate(
          signal('Race'),
          rule('Race', 'Same text'),
          { db, origin: origin() },
        ),
      ),
    );
    const ids = new Set(results.map((r) => r.signal.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    const rows = await db.execute(
      sql`select count(*)::int as n from coherences where space_id = ${spaceId} and title = 'Race'`,
    );
    const n = ((rows as { rows?: { n: number }[] }).rows ??
      (rows as unknown as { n: number }[]))[0]?.n;
    expect(n).toBe(1);
  });
});
