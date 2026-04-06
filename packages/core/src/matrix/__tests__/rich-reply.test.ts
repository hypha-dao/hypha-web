import { describe, expect, it } from 'vitest';

import {
  buildRichReplyPlainBody,
  stripMatrixReplyFallback,
  truncateForPreview,
} from '../rich-reply';

describe('stripMatrixReplyFallback', () => {
  it('removes quoted block before double newline', () => {
    const body = `> <@a:b> hi\n> there\n\nmy reply`;
    expect(stripMatrixReplyFallback(body)).toBe('my reply');
  });

  it('returns original when no reply structure', () => {
    expect(stripMatrixReplyFallback('plain')).toBe('plain');
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
