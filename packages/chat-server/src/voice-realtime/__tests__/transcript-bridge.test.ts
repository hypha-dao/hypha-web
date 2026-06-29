import { describe, expect, it } from 'vitest';

import {
  buildRecentTranscriptSummary,
  mergeAdjacentVoiceTranscriptTurns,
} from '../transcript-bridge';

describe('mergeAdjacentVoiceTranscriptTurns', () => {
  it('merges consecutive same-role turns', () => {
    expect(
      mergeAdjacentVoiceTranscriptTurns([
        { role: 'user', text: 'Hello' },
        { role: 'user', text: 'world' },
        { role: 'assistant', text: 'Hi there' },
      ]),
    ).toEqual([
      { role: 'user', text: 'Hello world' },
      { role: 'assistant', text: 'Hi there' },
    ]);
  });
});

describe('buildRecentTranscriptSummary', () => {
  it('formats recent turns for session instructions', () => {
    const summary = buildRecentTranscriptSummary([
      { role: 'user', text: 'We are building a DAO.' },
      { role: 'assistant', text: 'Tell me more about your mission.' },
    ]);
    expect(summary).toContain('User: We are building a DAO.');
    expect(summary).toContain('Assistant: Tell me more about your mission.');
  });

  it('returns undefined for empty input', () => {
    expect(buildRecentTranscriptSummary([])).toBeUndefined();
  });
});
