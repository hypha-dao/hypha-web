import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Only the origin constructors are needed; the full server entry pulls in unrelated modules.
vi.mock(
  '@hypha-platform/core/server',
  () => import('../../../../../../packages/core/src/origin'),
);

import { lookupClientName, resolveMcpClientOrigin } from '../client-origin';

const dbReturning = (value: unknown) => ({
  execute: vi.fn().mockResolvedValue(value),
});

describe('lookupClientName', () => {
  it('reads the stored name from either result shape', async () => {
    expect(
      await lookupClientName('c', {
        db: dbReturning({ rows: [{ name: 'Claude' }] }),
      }),
    ).toBe('Claude');
    expect(
      await lookupClientName('c', { db: dbReturning([{ name: 'Cursor' }]) }),
    ).toBe('Cursor');
  });

  it('gives null for a missing, blank or failed lookup', async () => {
    expect(
      await lookupClientName('c', { db: dbReturning({ rows: [] }) }),
    ).toBeNull();
    expect(
      await lookupClientName('c', {
        db: dbReturning({ rows: [{ name: '  ' }] }),
      }),
    ).toBeNull();
    expect(
      await lookupClientName('c', {
        db: { execute: vi.fn().mockRejectedValue(new Error('db down')) },
      }),
    ).toBeNull();
  });

  it('gives null when the lookup is slow', async () => {
    const slow = { execute: vi.fn(() => new Promise(() => undefined)) };
    expect(await lookupClientName('c', { db: slow }, 20)).toBeNull();
  });
});

describe('resolveMcpClientOrigin', () => {
  it('records the client id and the stored name', async () => {
    const origin = await resolveMcpClientOrigin('https://c.example/id.json', {
      db: dbReturning({ rows: [{ name: 'Claude' }] }),
    });
    expect(origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'https://c.example/id.json',
      clientLabel: 'Claude',
    });
  });

  it('still records the origin when the name is unavailable', async () => {
    const origin = await resolveMcpClientOrigin('c', {
      db: dbReturning({ rows: [] }),
    });
    expect(origin).toMatchObject({
      kind: 'mcp_client',
      clientId: 'c',
      clientLabel: null,
    });
  });

  it('refuses a token without a client id', async () => {
    await expect(
      resolveMcpClientOrigin(null, { db: dbReturning({ rows: [] }) }),
    ).rejects.toThrow(/client id/);
  });
});
