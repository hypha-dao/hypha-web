import { describe, expect, it } from 'vitest';
import {
  collectRemoteCallFeedUserIds,
  countMissingRemoteCallFeeds,
} from '../remote-call-media-stall';

function mockFeed(userId: string, local = false) {
  return {
    isLocal: () => local,
    userId,
  };
}

describe('collectRemoteCallFeedUserIds', () => {
  it('includes remote userMedia and screenshare feeds', () => {
    const ids = collectRemoteCallFeedUserIds({
      userMediaFeeds: [mockFeed('@a:hs')],
      screenshareFeeds: [mockFeed('@b:hs')],
    });
    expect([...ids].sort()).toEqual(['@a:hs', '@b:hs']);
  });

  it('ignores local feeds', () => {
    const ids = collectRemoteCallFeedUserIds({
      userMediaFeeds: [mockFeed('@me:hs', true)],
      screenshareFeeds: [mockFeed('@remote:hs')],
    });
    expect([...ids]).toEqual(['@remote:hs']);
  });
});

describe('countMissingRemoteCallFeeds', () => {
  it('counts participants without any inbound feed', () => {
    expect(
      countMissingRemoteCallFeeds(['@a:hs', '@b:hs'], new Set(['@a:hs'])),
    ).toBe(1);
  });

  it('treats screenshare-only remote as connected for stall detection', () => {
    const remoteIds = collectRemoteCallFeedUserIds({
      userMediaFeeds: [],
      screenshareFeeds: [mockFeed('@presenter:hs')],
    });
    expect(
      countMissingRemoteCallFeeds(['@presenter:hs', '@waiting:hs'], remoteIds),
    ).toBe(1);
  });
});
