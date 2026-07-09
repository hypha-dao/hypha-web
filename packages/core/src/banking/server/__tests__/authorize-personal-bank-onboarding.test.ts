import { beforeEach, describe, expect, it, vi } from 'vitest';

const findSelf = vi.fn();

vi.mock('../../../people/server/queries', () => ({
  findSelf: (...args: unknown[]) => findSelf(...args),
}));

vi.mock('../../../common/server/get-db', () => ({
  getDb: () => ({}),
}));

import { authorizePersonalBankOnboarding } from '../authorize-personal-bank-onboarding';

describe('authorizePersonalBankOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when findSelf returns null', async () => {
    findSelf.mockResolvedValue(null);

    const result = await authorizePersonalBankOnboarding({
      person: { id: 10 },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 401,
      message: 'Could not verify your identity.',
    });
  });

  it('returns 403 when the caller is not the profile owner', async () => {
    findSelf.mockResolvedValue({ id: 11, slug: 'bob' });

    const result = await authorizePersonalBankOnboarding({
      person: { id: 10 },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 403,
      message: 'You can only manage banking for your own profile.',
    });
  });

  it('authorizes the profile owner', async () => {
    findSelf.mockResolvedValue({ id: 10, slug: 'alice' });

    const result = await authorizePersonalBankOnboarding({
      person: { id: 10 },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: true,
      person: { id: 10, slug: 'alice' },
    });
  });
});
