import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const findPersonBySub = vi.fn();
vi.mock('../../data-access/people', () => ({
  findPersonBySub: (...a: unknown[]) => findPersonBySub(...a),
}));

import { resolveCaller } from '../resolve-caller';

const claims = {
  kind: 'user' as const,
  sub: 'did:privy:abc',
  clientId: 'https://client.example/cimd.json',
  scopes: ['spaces:read'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveCaller (verified authorization-server claims only)', () => {
  it('builds a user caller with via, looked up by the token subject', async () => {
    findPersonBySub.mockResolvedValue({ id: 9, address: '0xAbC' });
    const r = await resolveCaller(claims);
    expect(findPersonBySub).toHaveBeenCalledWith(
      { actor: { kind: 'service', name: 'identity' } },
      { sub: 'did:privy:abc' },
    );
    expect(r).toMatchObject({
      ok: true,
      caller: {
        kind: 'user',
        address: '0xAbC',
        via: {
          clientId: 'https://client.example/cimd.json',
          scopes: ['spaces:read'],
          spaceGrants: null,
        },
      },
    });
  });

  it('carries the space grants of the token (DB ids)', async () => {
    findPersonBySub.mockResolvedValue({ id: 9, address: null });
    const r = await resolveCaller({ ...claims, spaceGrants: [4, 7] });
    expect(r).toMatchObject({
      ok: true,
      caller: { address: null, via: { spaceGrants: [4, 7] } },
    });
  });

  it('carries the client name of the token, or null when it has none (#2756)', async () => {
    findPersonBySub.mockResolvedValue({ id: 9, address: null });
    expect(
      await resolveCaller({ ...claims, clientName: 'Example AI' }),
    ).toMatchObject({
      ok: true,
      caller: { via: { clientName: 'Example AI' } },
    });
    expect(await resolveCaller(claims)).toMatchObject({
      ok: true,
      caller: { via: { clientName: null } },
    });
  });

  it('a person without a profile is a typed failure, never a guest', async () => {
    findPersonBySub.mockResolvedValue(null);
    const r = await resolveCaller(claims);
    expect(r).toMatchObject({ ok: false, code: 'no_profile' });
    expect(JSON.stringify(r)).not.toContain('guest');
  });
});
