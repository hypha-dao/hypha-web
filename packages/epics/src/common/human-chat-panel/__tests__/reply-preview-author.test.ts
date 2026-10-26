import { describe, expect, it } from 'vitest';

import { resolveReplyPreviewAuthorLookup } from '../reply-preview-author';

const BRIDGED_MXID = '@prod_privy_did_privy_cmabc123:srv1294735.hstgr.cloud';

describe('resolveReplyPreviewAuthorLookup', () => {
  it('skips person lookups for your own message so hooks stay no-ops', () => {
    expect(
      resolveReplyPreviewAuthorLookup({
        isYou: true,
        sourceUserId: '@alice:hypha.earth',
        authorLabel: 'Alice',
      }),
    ).toEqual({
      kind: 'you',
      matrixUserId: '@alice:hypha.earth',
      canonicalSub: null,
      needsLinkLookup: false,
      needsPersonLookup: false,
    });
  });

  it('skips person lookups for the Hypha bot', () => {
    expect(
      resolveReplyPreviewAuthorLookup({
        isYou: false,
        sourceUserId: '@hypha_bot:matrix.hypha.earth',
        authorLabel: 'Bot',
      }),
    ).toEqual({
      kind: 'agent',
      matrixUserId: '@hypha_bot:matrix.hypha.earth',
      canonicalSub: null,
      needsLinkLookup: false,
      needsPersonLookup: false,
    });
  });

  it('skips lookups when the quoted author already has a friendly name', () => {
    expect(
      resolveReplyPreviewAuthorLookup({
        isYou: false,
        sourceUserId: '@alice:hypha.earth',
        authorLabel: 'Alice Prate',
      }),
    ).toMatchObject({
      kind: 'person',
      needsLinkLookup: false,
      needsPersonLookup: false,
    });
  });

  it('looks up a bridged member whose label is still a Privy slug', () => {
    const lookup = resolveReplyPreviewAuthorLookup({
      isYou: false,
      sourceUserId: BRIDGED_MXID,
      authorLabel: 'prod_privy_did_privy_cmabc123',
    });
    expect(lookup.kind).toBe('person');
    expect(lookup.needsPersonLookup).toBe(true);
    expect(lookup.needsLinkLookup || Boolean(lookup.canonicalSub)).toBe(true);
  });
});
