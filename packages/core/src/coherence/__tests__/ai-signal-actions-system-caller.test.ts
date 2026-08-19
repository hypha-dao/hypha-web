import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../common/server', () => ({
  getDb: vi.fn(() => ({} as never)),
  web3Client: {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'hasSpacePaid') return true;
      if (functionName === 'spacePayments') {
        return [BigInt(Math.floor(Date.now() / 1000) + 86400), false];
      }
      throw new Error(`unexpected functionName: ${functionName}`);
    }),
  },
}));
vi.mock('../../people/server/queries', () => ({
  findSelf: vi.fn(),
}));
vi.mock('../../space/server', () => ({
  checkSpaceAccessForSpace: vi.fn(),
  findSpaceBySlug: vi.fn(),
}));
vi.mock('../../space/server/web3', () => ({
  getAllOrganizationSpacesForNodeById: vi.fn(),
}));
vi.mock('../server/mutations', () => ({
  createCoherence: vi.fn(),
}));

import { createAiSignalForSpaceBySlug } from '../server/ai-signal-actions';
import {
  createSystemAiSignalForSpaceBySlug,
  relaySystemAiSignalToEcosystemSpace,
} from '../server/ai-signal-actions-system';
import { findSelf } from '../../people/server/queries';
import { checkSpaceAccessForSpace, findSpaceBySlug } from '../../space/server';
import { getAllOrganizationSpacesForNodeById } from '../../space/server/web3';
import { createCoherence } from '../server/mutations';

const mockedFindSelf = vi.mocked(findSelf);
const mockedCheckAccess = vi.mocked(checkSpaceAccessForSpace);
const mockedFindSpaceBySlug = vi.mocked(findSpaceBySlug);
const mockedCreateCoherence = vi.mocked(createCoherence);
const mockedGetEcosystemSpaces = vi.mocked(getAllOrganizationSpacesForNodeById);

const host = {
  id: 1,
  slug: 'test-space',
  web3SpaceId: 42,
} as never;

const baseInput = {
  spaceSlug: 'test-space',
  title: 'Something notable happened',
  description: 'A description long enough to pass validation checks.',
  type: 'Insight' as const,
  priority: 'medium' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFindSpaceBySlug.mockResolvedValue(host);
  mockedCreateCoherence.mockResolvedValue({
    id: 7,
    slug: 'coh-abc123',
    roomId: null,
  } as never);
});

describe('createSystemAiSignalForSpaceBySlug — orchestrator-only path', () => {
  it('succeeds with no authToken, skips the access gate, and writes a null creatorId', async () => {
    const result = await createSystemAiSignalForSpaceBySlug(baseInput, {
      db: {} as never,
    });

    expect(result.ok).toBe(true);
    expect(mockedCheckAccess).not.toHaveBeenCalled();
    expect(mockedFindSelf).not.toHaveBeenCalled();
    expect(mockedCreateCoherence).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: null }),
      expect.anything(),
    );
    if (result.ok) {
      expect(result.creatorId).toBeNull();
    }
  });
});

describe('createAiSignalForSpaceBySlug — user-facing path always requires real auth', () => {
  it('a real user with a valid authToken keeps the access gate and resolves a real creatorId', async () => {
    mockedCheckAccess.mockResolvedValue({ hasAccess: true });
    mockedFindSelf.mockResolvedValue({ id: 99 } as never);

    const result = await createAiSignalForSpaceBySlug(
      { ...baseInput, authToken: 'real-privy-jwt' },
      { db: {} as never },
    );

    expect(result.ok).toBe(true);
    expect(mockedCheckAccess).toHaveBeenCalledWith(host, 'real-privy-jwt');
    expect(mockedCreateCoherence).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: 99 }),
      expect.anything(),
    );
    if (result.ok) {
      expect(result.creatorId).toBe(99);
    }
  });

  it('a caller with no authToken is rejected (no accidental bypass — there is no flag to set)', async () => {
    const result = await createAiSignalForSpaceBySlug(
      { ...baseInput, authToken: '' },
      { db: {} as never },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('authToken is required');
    }
    expect(mockedFindSpaceBySlug).not.toHaveBeenCalled();
    expect(mockedCreateCoherence).not.toHaveBeenCalled();
  });
});

describe('relaySystemAiSignalToEcosystemSpace — ecosystem-root gate', () => {
  const sourceHost = {
    id: 10,
    slug: 'source-space',
    web3SpaceId: 100,
  };
  const targetHost = {
    id: 20,
    slug: 'target-space',
    web3SpaceId: 200,
  };

  const relayInput = {
    sourceSpaceSlug: 'source-space',
    targetSpaceSlug: 'target-space',
    title: 'Something notable happened',
    summary: 'A summary long enough to pass validation checks.',
    recommendedAction: 'Take a look',
    relevanceRationale: 'It affects both spaces',
    type: 'Insight' as const,
    priority: 'medium' as const,
  };

  beforeEach(() => {
    mockedFindSpaceBySlug.mockImplementation(
      async ({ slug }: { slug: string }) =>
        slug === sourceHost.slug
          ? (sourceHost as never)
          : slug === targetHost.slug
          ? (targetHost as never)
          : null,
    );
  });

  it('relays and writes creatorId: null when source and target share an ecosystem root', async () => {
    const root = { id: 1, parentId: null };
    const sharedEcosystem = [
      root,
      { id: sourceHost.id, parentId: root.id },
      { id: targetHost.id, parentId: root.id },
    ];
    mockedGetEcosystemSpaces.mockResolvedValue(sharedEcosystem as never);

    const result = await relaySystemAiSignalToEcosystemSpace(relayInput, {
      db: {} as never,
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateCoherence).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: null }),
      expect.anything(),
    );
    if (result.ok) {
      expect(result.creatorId).toBeNull();
    }
  });

  it('returns the ecosystem error and does not create a signal when the target is outside the source ecosystem', async () => {
    mockedGetEcosystemSpaces.mockImplementation(
      async ({ id }: { id?: number | null } = {}) =>
        (id === sourceHost.id
          ? [
              { id: 1, parentId: null },
              { id: sourceHost.id, parentId: 1 },
            ]
          : [
              { id: 2, parentId: null },
              { id: targetHost.id, parentId: 2 },
            ]) as never,
    );

    const result = await relaySystemAiSignalToEcosystemSpace(relayInput, {
      db: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/outside the source ecosystem/);
    }
    expect(mockedCreateCoherence).not.toHaveBeenCalled();
  });
});
