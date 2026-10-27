import { describe, expect, it } from 'vitest';

import {
  isMessagesNavHref,
  isSpacesNavHref,
  shouldShowMessagesNav,
  shouldShowSpacesScreen,
} from '../app-nav-visibility';

describe('app nav visibility', () => {
  it('hides the spaces screen from members and keeps messages', () => {
    expect(shouldShowSpacesScreen('member')).toBe(false);
    expect(shouldShowMessagesNav('member')).toBe(true);
  });

  it('keeps both entries for builders and an unset persona', () => {
    expect(shouldShowSpacesScreen('builder')).toBe(true);
    expect(shouldShowMessagesNav('builder')).toBe(true);
    expect(shouldShowSpacesScreen(null)).toBe(true);
    expect(shouldShowMessagesNav(undefined)).toBe(true);
  });

  it('keeps investors on home, wallet, and network', () => {
    expect(shouldShowSpacesScreen('investor')).toBe(false);
    expect(shouldShowMessagesNav('investor')).toBe(false);
  });

  it('matches messages and spaces hrefs separately', () => {
    expect(isMessagesNavHref('/en/messages')).toBe(true);
    expect(isSpacesNavHref('/en/messages')).toBe(false);
    expect(isSpacesNavHref('/en/my-spaces')).toBe(true);
    expect(isMessagesNavHref('/en/my-spaces')).toBe(false);
    expect(isSpacesNavHref(undefined)).toBe(false);
  });
});
