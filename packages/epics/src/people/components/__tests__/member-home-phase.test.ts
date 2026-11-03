import { describe, expect, it } from 'vitest';

import {
  memberHomeReplyReady,
  memberHomeShouldStartArrival,
  memberHomeShowArrivalMask,
  memberHomeThreadHasVisibleContent,
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

describe('memberHomeThreadHasVisibleContent', () => {
  it('ignores orphan homeArrival users and empty assistants', () => {
    expect(
      memberHomeThreadHasVisibleContent([
        {
          role: 'user',
          metadata: { homeArrival: true },
          content: 'I am on my home.',
        },
      ]),
    ).toBe(false);
    expect(
      memberHomeThreadHasVisibleContent([
        {
          role: 'user',
          metadata: { homeArrival: true },
          content: 'I am on my home.',
        },
        { role: 'assistant', parts: [{ type: 'text', text: '' }] },
      ]),
    ).toBe(false);
  });

  it('counts real user lines and assistant text', () => {
    expect(
      memberHomeThreadHasVisibleContent([
        { role: 'user', content: 'Where can I be useful?' },
      ]),
    ).toBe(true);
    expect(
      memberHomeThreadHasVisibleContent([
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Marco asked to join.' }],
        },
      ]),
    ).toBe(true);
  });
});

describe('memberHomeShowArrivalMask', () => {
  it('only covers the card while a reply is in flight', () => {
    expect(
      memberHomeShowArrivalMask({
        freshStart: false,
        hasError: false,
        liveReplyPending: true,
      }),
    ).toBe(true);
    expect(
      memberHomeShowArrivalMask({
        freshStart: false,
        hasError: false,
        liveReplyPending: false,
      }),
    ).toBe(false);
    expect(
      memberHomeShowArrivalMask({
        freshStart: true,
        hasError: false,
        liveReplyPending: true,
      }),
    ).toBe(false);
  });
});

describe('memberHomeShouldStartArrival', () => {
  it('starts arrival when work is waiting on an empty remount', () => {
    expect(
      memberHomeShouldStartArrival({
        hasVisibleContent: false,
        talkResting: false,
        welcome: false,
        threadItemCount: 3,
        lastSeen: 1_000,
      }),
    ).toEqual({ visit: 'welcome_back' });
  });

  it('leaves a true first open with no work to the static prompt', () => {
    expect(
      memberHomeShouldStartArrival({
        hasVisibleContent: false,
        talkResting: false,
        welcome: true,
        threadItemCount: 0,
        lastSeen: null,
      }),
    ).toBeNull();
  });

  it('does not restart over a visible thread or a resting talk', () => {
    expect(
      memberHomeShouldStartArrival({
        hasVisibleContent: true,
        talkResting: false,
        welcome: true,
        threadItemCount: 2,
        lastSeen: 1_000,
      }),
    ).toBeNull();
    expect(
      memberHomeShouldStartArrival({
        hasVisibleContent: false,
        talkResting: true,
        welcome: true,
        threadItemCount: 2,
        lastSeen: 1_000,
      }),
    ).toBeNull();
  });
});

describe('memberHomeReplyReady', () => {
  it('shows words as soon as they stream, even before the card lands', () => {
    expect(
      memberHomeReplyReady({
        text: 'Océane asked to join.',
        hasCard: false,
        streaming: true,
        expectsCard: true,
      }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({ text: '', hasCard: true, streaming: true }),
    ).toBe(true);
    expect(
      memberHomeReplyReady({
        text: 'Océane asked to join.',
        hasCard: true,
        streaming: true,
        expectsCard: true,
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
        expectsCard: true,
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
