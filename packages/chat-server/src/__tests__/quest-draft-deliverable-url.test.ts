import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { draftPatchSchema } from '../quest-draft-assist';

const unsafeUrls = [
  'javascript:alert(1)',
  '  javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html,hi',
  'data:text/html;base64,abc',
  'vbscript:msgbox(1)',
  'file:///tmp/x',
  'ftp://example.com/a',
];

describe('assistant quest deliverable URLs', () => {
  it('accepts an omitted, blank, or trimmed http(s) URL', () => {
    expect(
      draftPatchSchema.safeParse({
        deliverables: [{ name: 'Spec' }],
      }).success,
    ).toBe(true);
    expect(
      draftPatchSchema.safeParse({
        deliverables: [{ name: 'Spec', url: '' }],
      }).success,
    ).toBe(true);
    expect(
      draftPatchSchema.safeParse({
        deliverables: [{ name: 'Spec', url: '   ' }],
      }).success,
    ).toBe(true);
    expect(
      draftPatchSchema.parse({
        deliverables: [{ name: 'Spec', url: '  https://example.com/spec  ' }],
      }).deliverables?.[0]?.url,
    ).toBe('https://example.com/spec');
  });

  it('rejects javascript, data, and other non-http schemes', () => {
    for (const url of unsafeUrls) {
      expect(
        draftPatchSchema.safeParse({
          deliverables: [{ name: 'Spec', url }],
        }).success,
      ).toBe(false);
    }
  });
});
