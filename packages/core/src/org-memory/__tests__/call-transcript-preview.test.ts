import { describe, expect, it } from 'vitest';
import {
  callTranscriptPreview,
  previewCallTranscriptText,
} from '../call-transcript-preview';
import { buildSpaceMemoryItemsFromOrgMemoryPayload } from '../build-space-memory-items';

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
    const legacy = `${FLYWHEEL_TEXT.slice(0, 248)}...`;
    expect(legacy).toMatch(/apparent t\.\.\.$/);
    const preview = callTranscriptPreview({
      text: FLYWHEEL_TEXT,
      summary: legacy,
    });
    expect(preview).not.toMatch(/\.\.\.$/);
    expect(preview.endsWith('…')).toBe(true);
    const head = preview.slice(0, -1);
    expect(FLYWHEEL_TEXT[head.length]).toBe(' ');
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
