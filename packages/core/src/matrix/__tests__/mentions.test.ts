import { describe, expect, it } from 'vitest';

import {
  extractMentionUserIdsFromPlainBody,
  mentionsContentFromUserIds,
} from '../mentions';

describe('extractMentionUserIdsFromPlainBody', () => {
  it('extracts MXIDs', () => {
    expect(extractMentionUserIdsFromPlainBody('Hi @alice:matrix.org')).toEqual([
      '@alice:matrix.org',
    ]);
  });

  it('extracts MXIDs when localpart contains colons (bridged / Privy-style)', () => {
    const body = 'hey @prev_privy_did_privy_foo:bar:baz:matrix.org welcome';
    expect(extractMentionUserIdsFromPlainBody(body)).toEqual([
      '@prev_privy_did_privy_foo:bar:baz:matrix.org',
    ]);
  });

  it('does not treat a sentence-punctuation colon after the homeserver as part of the MXID', () => {
    expect(
      extractMentionUserIdsFromPlainBody('ping @alice:matrix.org: hello'),
    ).toEqual(['@alice:matrix.org']);
    expect(
      extractMentionUserIdsFromPlainBody('ping @alice:matrix.org, hello'),
    ).toEqual(['@alice:matrix.org']);
  });

  it('dedupes', () => {
    expect(
      extractMentionUserIdsFromPlainBody(
        '@alice:matrix.org ping @alice:matrix.org',
      ),
    ).toEqual(['@alice:matrix.org']);
  });

  it('returns empty when no mentions', () => {
    expect(extractMentionUserIdsFromPlainBody('hello')).toEqual([]);
  });
});

describe('mentionsContentFromUserIds', () => {
  it('returns undefined for empty input', () => {
    expect(mentionsContentFromUserIds([])).toBeUndefined();
  });

  it('filters invalid ids', () => {
    expect(
      mentionsContentFromUserIds(['alice', '@bad', '@ok:matrix.org']),
    ).toEqual({
      'm.mentions': {
        user_ids: ['@ok:matrix.org'],
      },
    });
  });
});
