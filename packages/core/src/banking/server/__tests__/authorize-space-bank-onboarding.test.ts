import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hypha-platform/ui-utils', () => ({
  canConvertToBigInt: (value: number) =>
    value != null && Number.isFinite(value) && value >= 0,
}));

import { authorizeSpaceBankOnboarding } from '../authorize-space-bank-onboarding';

const findSelf = vi.fn();
const isOnChainMemberOrDelegate = vi.fn();

vi.mock('../../../people/server/queries', () => ({
  findSelf: (...args: unknown[]) => findSelf(...args),
}));

vi.mock('../../../space/server/is-on-chain-member-or-delegate', () => ({
  isOnChainMemberOrDelegate: (...args: unknown[]) =>
    isOnChainMemberOrDelegate(...args),
}));

vi.mock('../../../common/server/get-db', () => ({
  getDb: () => ({}),
}));

describe('authorizeSpaceBankOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 422 when space has no web3SpaceId', async () => {
    const result = await authorizeSpaceBankOnboarding({
      space: { web3SpaceId: null, address: '0xabc' },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 422,
      message:
        'This space must be deployed on-chain before bank accounts can be enabled.',
    });
    expect(findSelf).not.toHaveBeenCalled();
  });

  it('returns 422 when space has no treasury address', async () => {
    const result = await authorizeSpaceBankOnboarding({
      space: { web3SpaceId: 42, address: null },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 422,
      message:
        'This space must have an on-chain treasury address before bank accounts can be enabled.',
    });
    expect(findSelf).not.toHaveBeenCalled();
  });

  it('returns 401 when findSelf returns null', async () => {
    findSelf.mockResolvedValue(null);

    const result = await authorizeSpaceBankOnboarding({
      space: {
        web3SpaceId: 42,
        address: '0xtreasury000000000000000000000000000001',
      },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 401,
      message: 'Could not verify your identity.',
    });
  });

  it('returns 403 when caller is not an on-chain member or delegate', async () => {
    findSelf.mockResolvedValue({
      id: 10,
      slug: 'alice',
      address: '0x1234567890123456789012345678901234567890',
    });
    isOnChainMemberOrDelegate.mockResolvedValue(false);

    const result = await authorizeSpaceBankOnboarding({
      space: {
        web3SpaceId: 42,
        address: '0xtreasury000000000000000000000000000001',
      },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: false,
      httpStatus: 403,
      message:
        'You must be a space member or delegate to enable bank accounts.',
    });
  });

  it('allows on-chain member or delegate with treasury deployed', async () => {
    findSelf.mockResolvedValue({
      id: 10,
      slug: 'alice',
      address: '0x1234567890123456789012345678901234567890',
    });
    isOnChainMemberOrDelegate.mockResolvedValue(true);

    const result = await authorizeSpaceBankOnboarding({
      space: {
        web3SpaceId: 42,
        address: '0xtreasury000000000000000000000000000001',
      },
      authToken: 'token',
    });

    expect(result).toEqual({
      authorized: true,
      person: { id: 10, slug: 'alice' },
    });
    expect(isOnChainMemberOrDelegate).toHaveBeenCalledWith(
      42,
      '0x1234567890123456789012345678901234567890',
    );
  });
});
