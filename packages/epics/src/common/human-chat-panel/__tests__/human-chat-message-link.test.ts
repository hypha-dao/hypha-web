import { describe, expect, it } from 'vitest';

import {
  buildHyphaChatMentionDeepLinkUrl,
  setSignalSearchParam,
} from '../human-chat-message-link';

describe('buildHyphaChatMentionDeepLinkUrl', () => {
  it('builds signal thread mention links with signal + msg params', () => {
    expect(
      buildHyphaChatMentionDeepLinkUrl({
        lang: 'en',
        spaceSlug: 'hypha-energy',
        signalSlug: 'my-signal',
        messageId: '$abc123',
        origin: 'https://app.hypha.earth',
      }),
    ).toBe(
      'https://app.hypha.earth/en/dho/hypha-energy?signal=my-signal&msg=%24abc123',
    );
  });

  it('builds space chat mention links with msg only when no signal slug', () => {
    expect(
      buildHyphaChatMentionDeepLinkUrl({
        lang: 'en',
        spaceSlug: 'hypha-energy',
        messageId: '$abc123',
      }),
    ).toBe('/en/dho/hypha-energy?msg=%24abc123');
  });

  it('includes chat room id when signal slug is absent', () => {
    expect(
      buildHyphaChatMentionDeepLinkUrl({
        lang: 'en',
        spaceSlug: 'hypha-energy',
        roomId: '!room:matrix.org',
        messageId: '$abc123',
      }),
    ).toBe('/en/dho/hypha-energy?chat=%21room%3Amatrix.org&msg=%24abc123');
  });
});

describe('setSignalSearchParam', () => {
  it('adds signal slug to the current path', () => {
    expect(
      setSignalSearchParam(
        '/en/dho/hypha-platform/coherence',
        'priority=high',
        'guidelines-for-signal-creation',
      ),
    ).toBe(
      '/en/dho/hypha-platform/coherence?priority=high&signal=guidelines-for-signal-creation',
    );
  });

  it('removes signal slug when cleared', () => {
    expect(
      setSignalSearchParam(
        '/en/dho/hypha-platform/coherence',
        'priority=high&signal=old-signal',
        null,
      ),
    ).toBe('/en/dho/hypha-platform/coherence?priority=high');
  });
});
