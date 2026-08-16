import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('../../../space/server/check-space-access-for-roster', () => ({
  checkSpaceAccessForSpace: vi.fn(),
}));

import { checkSpaceAccessForSpace } from '../../../space/server/check-space-access-for-roster';
import { gateIntelligenceSpaceAccess } from '../space-access';

const space = {
  id: 42,
  slug: 'belica-5-0',
  web3SpaceId: 99,
};

describe('gateIntelligenceSpaceAccess', () => {
  const mockedGate = vi.mocked(checkSpaceAccessForSpace);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips Privy membership when an IBA key is presented', async () => {
    const result = await gateIntelligenceSpaceAccess(
      space,
      { skipMembershipCheck: true },
      'belica-5-0',
    );

    expect(result).toEqual({ access: 'ok' });
    expect(mockedGate).not.toHaveBeenCalled();
  });

  it('still checks membership for member callers', async () => {
    mockedGate.mockResolvedValue({
      hasAccess: false,
      message: 'Not a member of this space.',
    } as never);

    const result = await gateIntelligenceSpaceAccess(
      space,
      { authToken: 'privy-token' },
      'belica-5-0',
    );

    expect(result).toMatchObject({
      access: 'denied',
      message: 'Not a member of this space.',
    });
    expect(mockedGate).toHaveBeenCalled();
  });
});
