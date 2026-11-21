import { describe, expect, it } from 'vitest';

import {
  isHomeNavHref,
  isMessagesNavHref,
  isNetworkNavHref,
  isSpacesNavHref,
  isWalletNavHref,
  shouldShowHomeNav,
  shouldShowMessagesNav,
  shouldShowNetworkNav,
  shouldShowSpacesScreen,
  shouldShowWalletNav,
} from '../app-nav-visibility';

describe('app nav visibility', () => {
  it('hides personal home, messages, wallet, spaces, and network from members', () => {
    expect(shouldShowHomeNav('member')).toBe(false);
    expect(shouldShowMessagesNav('member')).toBe(false);
    expect(shouldShowWalletNav('member')).toBe(false);
    expect(shouldShowSpacesScreen('member')).toBe(false);
    expect(shouldShowNetworkNav('member')).toBe(false);
  });

  it('keeps every entry for builders and an unset persona', () => {
    for (const orientation of ['builder', null, undefined] as const) {
      expect(shouldShowHomeNav(orientation)).toBe(true);
      expect(shouldShowMessagesNav(orientation)).toBe(true);
      expect(shouldShowWalletNav(orientation)).toBe(true);
      expect(shouldShowSpacesScreen(orientation)).toBe(true);
      expect(shouldShowNetworkNav(orientation)).toBe(true);
    }
  });

  it('keeps investors on home, wallet, network, and messages', () => {
    expect(shouldShowHomeNav('investor')).toBe(true);
    expect(shouldShowWalletNav('investor')).toBe(true);
    expect(shouldShowNetworkNav('investor')).toBe(true);
    expect(shouldShowMessagesNav('investor')).toBe(true);
    expect(shouldShowSpacesScreen('investor')).toBe(false);
  });

  it('matches each top-menu href separately', () => {
    expect(isHomeNavHref('/en/home')).toBe(true);
    expect(isMessagesNavHref('/en/messages')).toBe(true);
    expect(isWalletNavHref('/en/my-wallet')).toBe(true);
    expect(isSpacesNavHref('/en/my-spaces')).toBe(true);
    expect(isNetworkNavHref('/en/network')).toBe(true);
    expect(isSpacesNavHref('/en/messages')).toBe(false);
    expect(isMessagesNavHref('/en/my-spaces')).toBe(false);
    expect(isHomeNavHref('/en/my-wallet')).toBe(false);
    expect(isNetworkNavHref(undefined)).toBe(false);
  });
});
