import { afterEach, describe, expect, it, vi } from 'vitest';

// The real modules pull in the DB layer (needs a connection string) or the whole core client
// barrel; the helper only needs column placeholders and the pure mention functions.
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), inArray: vi.fn() }));
vi.mock('@hypha-platform/storage-postgres', () => ({
  matrixUserLinks: { matrixUserId: 'matrixUserId', privyUserId: 'privyUserId' },
  people: { name: 'name', surname: 'surname', sub: 'sub' },
}));
vi.mock(
  '@hypha-platform/core/client',
  () => import('../../../../../core/src/matrix/mentions'),
);

import { humanizeMessageBody } from '../humanize-message-body';

const MXID = '@prod_privy_did_privy_abc123:srv1294735.hstgr.cloud';

function fakeDb(where: () => unknown) {
  return {
    select: () => ({
      from: () => ({ innerJoin: () => ({ where }) }),
    }),
  } as never;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('humanizeMessageBody', () => {
  it('replaces a mentioned MXID with the person’s name', async () => {
    const db = fakeDb(() =>
      Promise.resolve([
        { matrixUserId: MXID, name: 'Gerardo', surname: 'Roza' },
      ]),
    );
    await expect(humanizeMessageBody(`hola ${MXID}`, { db })).resolves.toBe(
      'hola @Gerardo Roza',
    );
  });

  it('returns the raw body instead of throwing when the lookup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A Drizzle query failure's message embeds the bound params — here the mentioned MXID.
    const db = fakeDb(() =>
      Promise.reject(new Error(`Failed query: select … params: ${MXID}`)),
    );

    await expect(humanizeMessageBody(`hola ${MXID}`, { db })).resolves.toBe(
      `hola ${MXID}`,
    );
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(MXID);
  });

  it('does not query at all when the body has no mentions', async () => {
    const where = vi.fn();
    const db = fakeDb(where);
    await expect(humanizeMessageBody('just a message', { db })).resolves.toBe(
      'just a message',
    );
    expect(where).not.toHaveBeenCalled();
  });
});
