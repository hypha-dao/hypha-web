import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const gate = vi.fn();
vi.mock('../space-read-gate', () => ({
  authorizeSpaceRead: (...a: unknown[]) => gate(...a),
}));
vi.mock('../viewer-access', () => ({ filterSpacesForViewer: vi.fn() }));
vi.mock('../chain-reads', () => ({ readMemberAndDelegate: vi.fn() }));

import { decideSpaceWrite } from '../write-access';

const db = {} as never;
const SCOPE = 'signals:write';
const space = { id: 5, web3SpaceId: 50 };

type Over = {
  scopes?: string[];
  grants?: number[] | null;
  address?: string | null;
  via?: boolean;
};
const caller = ({
  scopes = ['spaces:read', SCOPE],
  grants = null,
  address = '0x1',
  via = true,
}: Over = {}) =>
  ({
    kind: 'user',
    person: { id: 7 },
    address,
    ...(via ? { via: { clientId: 'c', scopes, spaceGrants: grants } } : {}),
  } as never);

const membership = vi.fn();
const run = (
  c: never,
  s: typeof space | { id: number; web3SpaceId: null } = space,
) =>
  decideSpaceWrite(s, c, { scope: SCOPE }, { db, readMembership: membership });

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true });
  membership.mockResolvedValue({ isMember: true, isDelegate: false });
});

describe('decideSpaceWrite', () => {
  it('allows a member with the scope, the grant and read access', async () => {
    expect(await run(caller())).toEqual({ ok: true });
    expect(membership).toHaveBeenCalledWith(50, '0x1');
  });

  it('allows a delegate who is not a member', async () => {
    membership.mockResolvedValue({ isMember: false, isDelegate: true });
    expect(await run(caller())).toEqual({ ok: true });
  });

  it('refuses a person who is neither, with a message they can act on', async () => {
    membership.mockResolvedValue({ isMember: false, isDelegate: false });
    expect(await run(caller())).toMatchObject({
      ok: false,
      code: 'forbidden',
      message: expect.stringContaining('members and delegates'),
    });
  });

  it('fails closed without the write scope, before any read', async () => {
    expect(await run(caller({ scopes: ['spaces:read'] }))).toMatchObject({
      code: 'forbidden',
    });
    expect(gate).not.toHaveBeenCalled();
    expect(membership).not.toHaveBeenCalled();
  });

  it('fails closed for a caller that did not come through the authorization server', async () => {
    expect(await run(caller({ via: false }))).toMatchObject({
      code: 'unauthenticated',
    });
    expect(await run({ kind: 'guest' } as never)).toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('a space outside the grants is not found, without asking the chain', async () => {
    expect(await run(caller({ grants: [1, 2] }))).toMatchObject({
      code: 'not_found',
    });
    expect(await run(caller({ grants: [] }))).toMatchObject({
      code: 'not_found',
    });
    expect(membership).not.toHaveBeenCalled();
    expect(await run(caller({ grants: [5] }))).toEqual({ ok: true });
  });

  it('a space the caller may not see is not found (the read rule applies)', async () => {
    gate.mockResolvedValue({ ok: false, code: 'forbidden' });
    expect(await run(caller())).toMatchObject({ code: 'not_found' });
    expect(membership).not.toHaveBeenCalled();
  });

  it('a failed visibility check fails closed as unavailable', async () => {
    gate.mockResolvedValue({ ok: false, code: 'access_check_failed' });
    expect(await run(caller())).toMatchObject({ code: 'access_check_failed' });
  });

  it('a space with no on-chain id is not found', async () => {
    expect(await run(caller(), { id: 5, web3SpaceId: null })).toMatchObject({
      code: 'not_found',
    });
  });

  it('a person without a wallet address cannot be checked', async () => {
    expect(await run(caller({ address: null }))).toMatchObject({
      code: 'invalid_identity',
    });
  });

  it('a failed membership read fails closed', async () => {
    membership.mockRejectedValue(new Error('rpc down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await run(caller())).toMatchObject({ code: 'access_check_failed' });
  });
});
