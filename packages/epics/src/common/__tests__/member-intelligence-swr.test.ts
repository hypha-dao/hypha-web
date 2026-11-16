import { describe, expect, it, vi } from 'vitest';

import {
  ADD_PEOPLE_DIRECTORY_KEY,
  fetchMemberIntelligence,
  isAddPeopleDirectoryFailed,
  isAddPeopleDirectoryPending,
  isEnergyExemptMemberIntelligenceKey,
  MEMBER_INTELLIGENCE_PATH,
} from '../member-intelligence-swr';

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fetchMemberIntelligence', () => {
  it('returns null on 404 and throws on other non-OK statuses', async () => {
    const key = [MEMBER_INTELLIGENCE_PATH, 'token'] as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404)),
    );
    await expect(fetchMemberIntelligence(key)).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(500, { error: 'nope' })),
    );
    await expect(fetchMemberIntelligence(key)).rejects.toThrow(
      'member-intelligence 500',
    );

    const payload = { person: { id: 1 }, spaces: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, payload)),
    );
    await expect(fetchMemberIntelligence(key)).resolves.toEqual(payload);
    vi.unstubAllGlobals();
  });
});

describe('add-people directory energy exemption', () => {
  it('treats a gated/null key as pending, not failed', () => {
    expect(
      isEnergyExemptMemberIntelligenceKey([
        MEMBER_INTELLIGENCE_PATH,
        'jwt',
        ADD_PEOPLE_DIRECTORY_KEY,
      ]),
    ).toBe(true);
    expect(
      isEnergyExemptMemberIntelligenceKey([MEMBER_INTELLIGENCE_PATH, 'jwt']),
    ).toBe(false);

    expect(
      isAddPeopleDirectoryPending({
        addOpen: true,
        hasJwt: true,
        home: undefined,
        error: undefined,
      }),
    ).toBe(true);
    expect(
      isAddPeopleDirectoryFailed({
        addOpen: true,
        hasJwt: true,
        error: undefined,
      }),
    ).toBe(false);
    expect(
      isAddPeopleDirectoryFailed({
        addOpen: true,
        hasJwt: true,
        error: new Error('directory'),
      }),
    ).toBe(true);
  });
});
