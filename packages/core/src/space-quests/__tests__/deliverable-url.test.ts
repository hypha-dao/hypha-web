import { describe, expect, it } from 'vitest';
import {
  schemaPatchSpaceQuest,
  schemaQuestDeliverableInput,
} from '../validation';

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

describe('manual quest deliverable URLs', () => {
  it('accepts a blank, omitted, or trimmed http(s) URL', () => {
    expect(
      schemaQuestDeliverableInput.safeParse({ name: 'Spec' }).success,
    ).toBe(true);
    expect(
      schemaQuestDeliverableInput.safeParse({ name: 'Spec', url: null })
        .success,
    ).toBe(true);
    expect(
      schemaQuestDeliverableInput.safeParse({ name: 'Spec', url: '' }).success,
    ).toBe(true);
    expect(
      schemaQuestDeliverableInput.safeParse({ name: 'Spec', url: '   ' })
        .success,
    ).toBe(true);
    expect(
      schemaQuestDeliverableInput.parse({
        name: 'Spec',
        url: '  HTTPS://example.com/spec  ',
      }).url,
    ).toBe('HTTPS://example.com/spec');
    expect(
      schemaPatchSpaceQuest.parse({
        deliverables: [{ name: 'Spec', url: ' http://example.com/a ' }],
      }).deliverables?.[0]?.url,
    ).toBe('http://example.com/a');
  });

  it('rejects non-http schemes on the deliverable and the patch', () => {
    for (const url of unsafeUrls) {
      expect(
        schemaQuestDeliverableInput.safeParse({ name: 'Spec', url }).success,
      ).toBe(false);
      expect(
        schemaPatchSpaceQuest.safeParse({
          deliverables: [{ name: 'Spec', url }],
        }).success,
      ).toBe(false);
    }
  });
});
