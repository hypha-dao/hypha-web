import { describe, expect, it } from 'vitest';

import {
  assessSpacePrivacy,
  SpaceTransparencyLevel,
  transparencyLevelsMatchRequest,
} from '../transparency-policy';

describe('assessSpacePrivacy', () => {
  it('treats sandbox spaces with restrictive on-chain levels as already private', () => {
    const result = assessSpacePrivacy({
      flags: ['sandbox'],
      transparency: {
        discoverability: SpaceTransparencyLevel.SPACE,
        access: SpaceTransparencyLevel.ORGANISATION,
      },
    });

    expect(result.isAlreadyPrivate).toBe(true);
    expect(result.activationMode).toBe('sandbox');
  });

  it('treats sandbox flag as private even when on-chain read is unavailable', () => {
    const result = assessSpacePrivacy({
      flags: ['sandbox'],
      transparency: null,
    });

    expect(result.isAlreadyPrivate).toBe(true);
    expect(result.summary).toContain('Sandbox');
  });

  it('does not treat public discoverability as private', () => {
    const result = assessSpacePrivacy({
      flags: [],
      transparency: {
        discoverability: SpaceTransparencyLevel.PUBLIC,
        access: SpaceTransparencyLevel.PUBLIC,
      },
    });

    expect(result.isAlreadyPrivate).toBe(false);
  });
});

describe('transparencyLevelsMatchRequest', () => {
  it('matches when requested levels equal current levels', () => {
    expect(
      transparencyLevelsMatchRequest(
        { discoverability: 3, access: 2 },
        { discoverability: 3, access: 2 },
      ),
    ).toBe(true);
  });

  it('matches when only one dimension is specified and equal', () => {
    expect(
      transparencyLevelsMatchRequest(
        { discoverability: 3, access: 2 },
        { discoverability: 3 },
      ),
    ).toBe(true);
  });

  it('does not match when a requested level differs', () => {
    expect(
      transparencyLevelsMatchRequest(
        { discoverability: 3, access: 2 },
        { discoverability: 1, access: 2 },
      ),
    ).toBe(false);
  });
});
