import { describe, expect, it } from 'vitest';

import {
  buildRichReplyPlainBody,
  isLocalProvisionalEventId,
  stripMatrixReplyFallback,
  truncateForPreview,
} from '../rich-reply';

describe('stripMatrixReplyFallback', () => {
  it('removes quoted block before double newline', () => {
    const body = `> <@a:b> hi\n> there\n\nmy reply`;
    expect(stripMatrixReplyFallback(body)).toBe('my reply');
  });

  it('strips nested reply parent so preview is only the visible line', () => {
    const nestedParent = `> <@u:h> hello\n> there\n\nhey`;
    expect(stripMatrixReplyFallback(nestedParent).trim()).toBe('hey');
  });

  it('returns original when no reply structure', () => {
    expect(stripMatrixReplyFallback('plain')).toBe('plain');
  });
});

describe('isLocalProvisionalEventId', () => {
  it('detects provisional client ids', () => {
    expect(
      isLocalProvisionalEventId(
        '~!EbLD2GFiUPLzqn6N:srv1294735.hstgr.cloud:m1775513342375.0',
      ),
    ).toBe(true);
  });

  it('does not flag server ids', () => {
    expect(isLocalProvisionalEventId('$abc:example.com')).toBe(false);
  });
});

describe('truncateForPreview', () => {
  it('truncates long text', () => {
    const s = 'a'.repeat(300);
    expect(truncateForPreview(s, 10).length).toBe(10);
    expect(truncateForPreview(s, 10).endsWith('…')).toBe(true);
  });
});

describe('buildRichReplyPlainBody', () => {
  it('builds Matrix-style quoted fallback', () => {
    const out = buildRichReplyPlainBody('@u:h', 'hello', 'world');
    expect(out).toContain('> <@u:h> hello');
    expect(out).toContain('\n\nworld');
  });
});
