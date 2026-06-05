import { describe, expect, it } from 'vitest';

import {
  contentMentionsMatrixUser,
  extractMentionUserIdsFromPlainBody,
  isLikelyMatrixUserId,
  mentionsContentFromUserIds,
  parseMentionUserIdsFromWireContent,
  replacePlainTextMatrixMxidsWithLabels,
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

  it('strips a trailing sentence period captured inside the homeserver segment', () => {
    expect(
      extractMentionUserIdsFromPlainBody('ping @alice:matrix.org. hello'),
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

describe('contentMentionsMatrixUser', () => {
  const u = '@viewer:example.org';
  it('is true for MSC3952 m.mentions', () => {
    expect(
      contentMentionsMatrixUser(
        { 'm.mentions': { user_ids: [u] }, body: 'hi' },
        u,
      ),
    ).toBe(true);
  });
  it('is true when only body has @mxid (no m.mentions)', () => {
    expect(
      contentMentionsMatrixUser(
        { body: `hello ${u} there`, msgtype: 'm.text' },
        u,
      ),
    ).toBe(true);
  });
  it('ignores mxids only inside rich-reply quoted prefix', () => {
    const quoted = `> <@other:example.org> parent\n\nhello`;
    expect(contentMentionsMatrixUser({ body: quoted }, u)).toBe(false);
  });
  it('is false when neither field mentions user', () => {
    expect(
      contentMentionsMatrixUser(
        {
          body: 'no mention',
          'm.mentions': { user_ids: ['@other:example.org'] },
        },
        u,
      ),
    ).toBe(false);
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

describe('replacePlainTextMatrixMxidsWithLabels', () => {
  it('replaces @mxid tokens with resolved labels', () => {
    const plain = 'Hi @prod_privy_did_privy_foo:bar:matrix.org please review';
    const out = replacePlainTextMatrixMxidsWithLabels(plain, (id) =>
      id.includes('prod_privy') ? 'Alex Prate' : id,
    );
    expect(out).toBe('Hi Alex Prate please review');
  });
});

describe('replacePlainTextMatrixMxidsWithLabels', () => {
  it('replaces @mxid tokens with resolved labels', () => {
    const plain = 'Hi @prod_privy_did_privy_foo:bar:matrix.org please review';
    const out = replacePlainTextMatrixMxidsWithLabels(plain, (id) =>
      id.includes('prod_privy') ? 'Alex Prate' : id,
    );
    expect(out).toBe('Hi Alex Prate please review');
  });
});
