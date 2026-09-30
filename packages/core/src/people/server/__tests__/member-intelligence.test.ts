import { describe, expect, it } from 'vitest';

import {
  buildMemberGuidance,
  parseMemberOrientation,
} from '../../member-intelligence-guidance';

describe('parseMemberOrientation', () => {
  it('keeps the three orientations and treats anything else as unset', () => {
    expect(parseMemberOrientation('member')).toBe('member');
    expect(parseMemberOrientation('builder')).toBe('builder');
    expect(parseMemberOrientation('investor')).toBe('investor');
    expect(parseMemberOrientation(null)).toBeNull();
    expect(parseMemberOrientation('guest')).toBeNull();
  });
});

describe('buildMemberGuidance', () => {
  it('points at the first decision that needs the member', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'member',
        spaceCount: 2,
        attention: {
          kind: 'proposal',
          title: 'Fund the winter greenhouse',
          spaceTitle: 'Noord Food Commons',
        },
      }),
    ).toBe(
      'Hi Alex. Fund the winter greenhouse in Noord Food Commons is open for a decision. That is the most useful place to step in right now.',
    );
  });

  it('invites a builder with no spaces to shape one', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'builder',
        spaceCount: 0,
        attention: null,
      }),
    ).toContain('shape a space');
  });

  it('points an investor toward the marketplace when nothing is waiting', () => {
    expect(
      buildMemberGuidance({
        firstName: 'Alex',
        orientation: 'investor',
        spaceCount: 3,
        attention: null,
      }),
    ).toContain('marketplace');
  });
});
