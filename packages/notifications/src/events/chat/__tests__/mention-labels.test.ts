import { describe, expect, it, vi } from 'vitest';

// The real `@hypha-platform/core/client` barrel drags in the DB layer (needs a connection string);
// the mention helpers themselves are pure, so load them straight from their module.
vi.mock(
  '@hypha-platform/core/client',
  () => import('../../../../../core/src/matrix/mentions'),
);

import {
  applyMentionLabels,
  extractMentionUserIdsFromPlainBody,
  formatMentionLabel,
} from '../mention-labels';

const MXID = '@prod_privy_did_privy_abc123:srv1294735.hstgr.cloud';

describe('formatMentionLabel', () => {
  it('formats name and surname like the chat UI', () => {
    expect(formatMentionLabel('Gerardo', 'Roza')).toBe('@Gerardo Roza');
  });

  it('works with only a name', () => {
    expect(formatMentionLabel('Gerardo', null)).toBe('@Gerardo');
  });

  it('returns null when there is nothing to show', () => {
    expect(formatMentionLabel(null, undefined)).toBeNull();
    expect(formatMentionLabel('  ', '')).toBeNull();
  });
});

describe('applyMentionLabels', () => {
  it('replaces a known MXID with the person’s name', () => {
    const labels = new Map([[MXID, '@Gerardo Roza']]);
    const body = `otra mencion para ${MXID}`;
    expect(extractMentionUserIdsFromPlainBody(body)).toEqual([MXID]);
    expect(applyMentionLabels(body, labels)).toBe(
      'otra mencion para @Gerardo Roza',
    );
  });

  it('replaces every mention in a message', () => {
    const other = '@prod_privy_did_privy_xyz789:srv1294735.hstgr.cloud';
    const labels = new Map([
      [MXID, '@Ann Lee'],
      [other, '@Bo Kim'],
    ]);
    expect(applyMentionLabels(`hey ${MXID} and ${other}!`, labels)).toBe(
      'hey @Ann Lee and @Bo Kim!',
    );
  });

  it('leaves an MXID with no label as it was', () => {
    const body = `ping ${MXID}`;
    expect(applyMentionLabels(body, new Map())).toBe(body);
  });

  it('leaves text without mentions untouched', () => {
    expect(applyMentionLabels('just a message', new Map())).toBe(
      'just a message',
    );
  });
});
