import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const verifyPrivyAuthToken = vi.fn();
const findPersonBySub = vi.fn();
const findSelf = vi.fn();
const getDb = vi.fn();

vi.mock('../../../common/server/verify-privy-auth-token', () => ({
  verifyPrivyAuthToken: (...args: unknown[]) => verifyPrivyAuthToken(...args),
}));

vi.mock('../queries', () => ({
  findPersonBySub: (...args: unknown[]) => findPersonBySub(...args),
  findSelf: (...args: unknown[]) => findSelf(...args),
}));

vi.mock('../../../common/server/get-db', () => ({
  getDb: (...args: unknown[]) => getDb(...args),
}));

vi.mock('@hypha-platform/storage-postgres', () => ({
  db: {},
}));

import { resolvePersonFromAuthToken } from '../resolve-person-from-auth-token';

describe('resolvePersonFromAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when auth token is missing', async () => {
    await expect(resolvePersonFromAuthToken(undefined)).resolves.toBeNull();
    expect(verifyPrivyAuthToken).not.toHaveBeenCalled();
  });

  it('returns person from Privy sub lookup', async () => {
    verifyPrivyAuthToken.mockResolvedValue({
      ok: true,
      userId: 'did:privy:abc',
    });
    findPersonBySub.mockResolvedValue({
      id: 1,
      slug: 'alex',
      address: '0xabc',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const person = await resolvePersonFromAuthToken('token');
    expect(person?.slug).toBe('alex');
    expect(findSelf).not.toHaveBeenCalled();
  });

  it('falls back to findSelf when Privy lookup misses', async () => {
    verifyPrivyAuthToken.mockResolvedValue({
      ok: true,
      userId: 'did:privy:abc',
    });
    findPersonBySub.mockResolvedValue(null);
    getDb.mockReturnValue({ auth: true });
    findSelf.mockResolvedValue({
      id: 2,
      slug: 'fallback',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const person = await resolvePersonFromAuthToken('token');
    expect(person?.slug).toBe('fallback');
    expect(findSelf).toHaveBeenCalledOnce();
  });

  it('returns null when both lookups fail', async () => {
    verifyPrivyAuthToken.mockResolvedValue({ ok: false, reason: 'expired' });
    getDb.mockReturnValue({ auth: true });
    findSelf.mockRejectedValue(new Error('rls failed'));

    await expect(resolvePersonFromAuthToken('token')).resolves.toBeNull();
  });
});
