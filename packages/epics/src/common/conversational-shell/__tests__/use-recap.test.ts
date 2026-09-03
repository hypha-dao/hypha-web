import { describe, expect, it } from 'vitest';

import { buildRecap, summarizeTurn } from '../use-recap';
import type { ConversationMessage } from '../types';

function turn(
  id: string,
  role: 'user' | 'assistant',
  text: string,
): ConversationMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

describe('summarizeTurn', () => {
  it('takes the first sentence when it is short enough', () => {
    expect(summarizeTurn('Show me the signals. Then the treasury.')).toBe(
      'Show me the signals.',
    );
  });

  it('strips markdown and collapses whitespace', () => {
    expect(summarizeTurn('**Here** are\n\nthe  `signals`')).toBe(
      'Here are the signals',
    );
  });

  it('truncates a long single sentence with an ellipsis', () => {
    const long = `${'a'.repeat(200)}`;
    const out = summarizeTurn(long);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(140);
  });

  it('returns empty string for an empty turn', () => {
    expect(summarizeTurn('')).toBe('');
  });
});

describe('buildRecap', () => {
  it('pairs each user turn with the following assistant turn, newest first', () => {
    const recap = buildRecap([
      turn('u1', 'user', 'show signals'),
      turn('a1', 'assistant', 'Here are the signals.'),
      turn('u2', 'user', 'now the treasury'),
      turn('a2', 'assistant', 'Here is the treasury.'),
    ]);

    expect(recap).toEqual([
      {
        messageId: 'u2',
        askSummary: 'now the treasury',
        answerSummary: 'Here is the treasury.',
        ageRank: 0,
      },
      {
        messageId: 'u1',
        askSummary: 'show signals',
        answerSummary: 'Here are the signals.',
        ageRank: 1,
      },
    ]);
  });

  it('caps the number of entries', () => {
    const messages: ConversationMessage[] = [];
    for (let i = 0; i < 6; i += 1) {
      messages.push(turn(`u${i}`, 'user', `ask ${i}`));
      messages.push(turn(`a${i}`, 'assistant', `answer ${i}`));
    }
    const recap = buildRecap(messages, 2);
    expect(recap.map((r) => r.messageId)).toEqual(['u5', 'u4']);
  });

  it('includes a still-unanswered trailing user turn with an empty answer', () => {
    const recap = buildRecap([
      turn('u1', 'user', 'show signals'),
      turn('a1', 'assistant', 'done'),
      turn('u2', 'user', 'and the members?'),
    ]);
    expect(recap[0]).toMatchObject({ messageId: 'u2', answerSummary: '' });
  });

  it('falls back to string content when there are no text parts', () => {
    const recap = buildRecap([
      { id: 'u1', role: 'user', content: 'plain content' },
      { id: 'a1', role: 'assistant', content: 'plain reply' },
    ]);
    expect(recap[0]).toMatchObject({
      askSummary: 'plain content',
      answerSummary: 'plain reply',
    });
  });
});
