import { describe, expect, it } from 'vitest';
import {
  callTranscriptPreview,
  previewCallTranscriptText,
} from '../call-transcript-preview';
import { buildSpaceMemoryItemsFromOrgMemoryPayload } from '../build-space-memory-items';

function hasUnpairedSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

const FLYWHEEL_TEXT =
  "yeah the only thing that the call was good I think there's a lot we can do together you know so there's cross pollination you know into all of these projects and because I'm involved in quite a few I see the connections right so what was apparent to me is that we keep circling the same questions and nobody writes them down";

describe('previewCallTranscriptText', () => {
  it('returns short text unchanged (whitespace collapsed)', () => {
    expect(previewCallTranscriptText('  hello   world  ')).toBe('hello world');
  });

  it('cuts on a word boundary with a single ellipsis', () => {
    const preview = previewCallTranscriptText(FLYWHEEL_TEXT, 250);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview).not.toMatch(/\.\.\.$/);
    const head = preview.slice(0, -1);
    expect(FLYWHEEL_TEXT.startsWith(head)).toBe(true);
    expect(FLYWHEEL_TEXT[head.length]).toBe(' ');
    expect(head.length).toBeLessThanOrEqual(250);
  });

  it('keeps a word that ends exactly at the limit', () => {
    expect(previewCallTranscriptText('alpha beta gamma', 10)).toBe(
      'alpha beta…',
    );
  });

  it('drops a high surrogate when an emoji straddles the cut', () => {
    const emoji = '👍';
    const text = `words ${emoji} and more words after the emoji`;
    const preview = previewCallTranscriptText(text, text.indexOf(emoji) + 1);
    expect(preview).toBe('words…');
    expect(hasUnpairedSurrogate(preview)).toBe(false);
  });

  it('breaks on the last space even when it sits in the first half', () => {
    expect(previewCallTranscriptText(`hi ${'x'.repeat(30)}`, 20)).toBe('hi…');
  });

  it('hard-cuts only when the window has no space', () => {
    expect(
      previewCallTranscriptText(`${'x'.repeat(40)} trailing words`, 20),
    ).toBe(`${'x'.repeat(20)}…`);
  });

  it('prefers a late sentence stop', () => {
    const text = `${'word '.repeat(30)}end of thought. ${'more '.repeat(40)}`;
    const preview = previewCallTranscriptText(text, 200);
    expect(preview.endsWith('end of thought.')).toBe(true);
  });
});

describe('callTranscriptPreview', () => {
  it('keeps a caller-supplied summary', () => {
    expect(
      callTranscriptPreview({
        text: FLYWHEEL_TEXT,
        summary: 'Cross pollination.',
      }),
    ).toBe('Cross pollination.');
  });

  it('regenerates legacy mid-word auto-cuts from the full text', () => {
    const text = `${'intro '.repeat(12)}${FLYWHEEL_TEXT}`;
    const legacy = `${text.slice(0, 320)}...`;
    expect(legacy.replace(/\.\.\.$/, '').length).toBeGreaterThanOrEqual(315);
    const preview = callTranscriptPreview({ text, summary: legacy });
    expect(preview).not.toBe(legacy);
    expect(preview).not.toMatch(/\.\.\.$/);
    expect(preview.endsWith('…')).toBe(true);
    const head = preview.slice(0, -1);
    expect(text[head.length]).toBe(' ');
  });

  it('keeps a short ellipsis summary that is a transcript prefix', () => {
    const summary = 'yeah the only thing that the call was good…';
    expect(FLYWHEEL_TEXT.startsWith(summary.replace(/…$/, ''))).toBe(true);
    expect(callTranscriptPreview({ text: FLYWHEEL_TEXT, summary })).toBe(
      summary,
    );
  });

  it('regenerates the 320-char auto-cut of a speaker-labelled transcript', () => {
    const text = `prod_privy_did_privy_cmabcdefghijklmnopqrstuvwx: ${FLYWHEEL_TEXT}\nprod_privy_did_privy_cmzyxwvutsrqponmlkjihgfedc: agreed`;
    const legacyCut = `${text.replace(/\s+/g, ' ').slice(0, 320)}...`;
    const preview = callTranscriptPreview({ text, summary: legacyCut });
    expect(preview).not.toBe(legacyCut);
    expect(preview).not.toMatch(/\.\.\.$/);
    const head = preview.slice(0, -1);
    expect(text.replace(/\s+/g, ' ')[head.length]).toBe(' ');
  });

  it('falls back to the full text when no summary is stored', () => {
    expect(callTranscriptPreview({ text: 'short call', summary: null })).toBe(
      'short call',
    );
  });
});

describe('call transcript items', () => {
  it('carry the transcript id so the full text can be opened', () => {
    const [item] = buildSpaceMemoryItemsFromOrgMemoryPayload({
      org_memory_assets: [
        {
          source: 'call_transcript',
          filename: 'space-hypha-flywheel',
          call_session_id: 'session-1',
          call_transcript_id: 42,
          text_excerpt: 'Preview…',
          room_title: 'space-hypha-flywheel',
          occurred_at: '2026-11-03T10:00:00.000Z',
        },
      ],
    });
    expect(item?.context.callTranscriptId).toBe(42);
  });
});
