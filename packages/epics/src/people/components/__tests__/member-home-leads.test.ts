import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEMBER_HOME_PEOPLE_LEAD_KEYS,
  MEMBER_HOME_SPACE_LEAD_KEYS,
  MEMBER_HOME_TOKENS_LEAD_KEYS,
  nextMemberHomeLeadKey,
} from '../member-home-leads';

describe('nextMemberHomeLeadKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rotates space and people keys independently across the session', () => {
    const store = new Map<string, string>();
    const session = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('window', { sessionStorage: session });

    expect(nextMemberHomeLeadKey('space', MEMBER_HOME_SPACE_LEAD_KEYS)).toBe(
      'spaceLead',
    );
    expect(nextMemberHomeLeadKey('space', MEMBER_HOME_SPACE_LEAD_KEYS)).toBe(
      'spaceLeadAlt2',
    );
    expect(nextMemberHomeLeadKey('people', MEMBER_HOME_PEOPLE_LEAD_KEYS)).toBe(
      'peopleAroundLead',
    );
    expect(nextMemberHomeLeadKey('space', MEMBER_HOME_SPACE_LEAD_KEYS)).toBe(
      'spaceLeadAlt3',
    );
    expect(nextMemberHomeLeadKey('space', MEMBER_HOME_SPACE_LEAD_KEYS)).toBe(
      'spaceLead',
    );
    expect(nextMemberHomeLeadKey('people', MEMBER_HOME_PEOPLE_LEAD_KEYS)).toBe(
      'peopleAroundLeadAlt2',
    );
    expect(nextMemberHomeLeadKey('tokens', MEMBER_HOME_TOKENS_LEAD_KEYS)).toBe(
      'tokensLead',
    );
    expect(nextMemberHomeLeadKey('tokens', MEMBER_HOME_TOKENS_LEAD_KEYS)).toBe(
      'tokensLeadAlt2',
    );
  });
});
