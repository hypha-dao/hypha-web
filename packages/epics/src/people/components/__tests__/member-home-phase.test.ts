import { describe, expect, it } from 'vitest';

import { resolveMemberHomePhase } from '../member-home-phase';

const settled = {
  authLoading: false,
  jwtLoading: false,
  authenticated: true,
  personLoading: false,
  person: 'present' as const,
  meError: false,
  homeLoading: false,
  home: 'present' as const,
  homeError: false,
};

describe('resolveMemberHomePhase', () => {
  it('shows sign-in only after auth settles signed out', () => {
    expect(
      resolveMemberHomePhase({
        ...settled,
        authenticated: false,
        person: 'missing',
        home: 'missing',
      }),
    ).toBe('signed-out');
  });

  it('keeps a Privy session on the loading state until the token exists', () => {
    expect(
      resolveMemberHomePhase({
        ...settled,
        jwtLoading: true,
        person: 'missing',
        home: 'missing',
      }),
    ).toBe('loading');
  });

  it('sends a confirmed missing person row to signup', () => {
    expect(
      resolveMemberHomePhase({
        ...settled,
        person: 'none',
        home: 'none',
      }),
    ).toBe('signup');
  });

  it('does not treat a profile 500 as signed out or as no profile', () => {
    expect(
      resolveMemberHomePhase({
        ...settled,
        person: 'missing',
        home: 'missing',
        meError: true,
      }),
    ).toBe('profile-unavailable');
  });

  it('keeps a loaded person on home when intelligence fails', () => {
    expect(
      resolveMemberHomePhase({
        ...settled,
        home: 'none',
        homeError: false,
      }),
    ).toBe('home-unavailable');
    expect(
      resolveMemberHomePhase({
        ...settled,
        meError: true,
      }),
    ).toBe('ready');
  });

  it('shows member home when the person and intelligence both loaded', () => {
    expect(resolveMemberHomePhase(settled)).toBe('ready');
  });
});
