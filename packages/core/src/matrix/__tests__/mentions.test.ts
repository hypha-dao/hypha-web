import { describe, expect, it } from 'vitest';

import {
  extractMentionUserIdsFromPlainBody,
  isLikelyMatrixUserId,
  mentionsContentFromUserIds,
  parseMentionUserIdsFromWireContent,
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

  it('strips only sentence punctuation after host:port (not the port colon)', () => {
    expect(
      extractMentionUserIdsFromPlainBody('ping @alice:matrix.org:8448: hello'),
    ).toEqual(['@alice:matrix.org:8448']);
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

describe('isLikelyMatrixUserId', () => {
  it('rejects values with junk after the homeserver (not a single MXID string)', () => {
    expect(isLikelyMatrixUserId('@alice:matrix.org extra')).toBe(false);
  });
  it('accepts a normal MXID', () => {
    expect(isLikelyMatrixUserId('@alice:matrix.org')).toBe(true);
  });
});

describe('parseMentionUserIdsFromWireContent', () => {
  it('drops invalid wire ids', () => {
    expect(
      parseMentionUserIdsFromWireContent({
        'm.mentions': {
          user_ids: ['@good:matrix.org', '@bad junk', 'nope'],
        },
      }),
    ).toEqual(['@good:matrix.org']);
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
