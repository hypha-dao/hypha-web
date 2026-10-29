import { describe, expect, it } from 'vitest';

import {
  memberHomeReplyReady,
  resolveMemberHomeGreetingName,
  resolveMemberHomePhase,
} from '../member-home-phase';

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
        home: 'missing',
        homeError: true,
      }),
    ).toBe('home-unavailable');
    // A request abort / network block is an intelligence error, not /me.
    expect(
      resolveMemberHomePhase({
        ...settled,
        person: 'present',
        home: 'missing',
        homeError: true,
        meError: false,
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

describe('memberHomeReplyReady', () => {
  it('prompts the card first, then shows words as they stream', () => {
    expect(
      memberHomeReplyReady({ text: '', hasCard: true, streaming: true }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({
        text: 'Océane asked to join.',
        hasCard: true,
        streaming: true,
      }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({
        text: 'Océane asked to join.',
        hasCard: false,
        streaming: true,
      }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({ text: '', hasCard: false, streaming: true }),
    ).toBe(false);
  });

  it('shows finished words or a finished card', () => {
    expect(
      memberHomeReplyReady({
        text: 'Océane asked to join.',
        hasCard: true,
        streaming: false,
      }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({
        text: 'Nothing is waiting.',
        hasCard: false,
        streaming: false,
      }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({ text: '', hasCard: true, streaming: false }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({ text: '', hasCard: false, streaming: false }),
    ).toBe(false);
  });
});

describe('resolveMemberHomeGreetingName', () => {
  it('returns a name only when the person is the current member', () => {
    expect(
      resolveMemberHomeGreetingName({
        personName: 'Vlad',
        personNickname: 'v',
        personIsCurrentMember: false,
      }),
    ).toBeNull();
    expect(
      resolveMemberHomeGreetingName({
        personName: 'Vlad',
        personNickname: 'v',
        personIsCurrentMember: true,
      }),
    ).toBe('Vlad');
  });
});
