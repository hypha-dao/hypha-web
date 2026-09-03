'use client';

import { useMemo } from 'react';

import type { ConversationMessage, ConversationRecap } from './types';

export const DEFAULT_RECAP_CAP = 3;
const SUMMARY_MAX = 140;

/** Plain-text of a message: joins text parts, falls back to `content`. */
function messageText(message: ConversationMessage): string {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const fromParts = parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const type = (part as { type?: unknown }).type;
      if (type !== 'text' && type !== 'reasoning') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fromParts) return fromParts;
  return typeof message.content === 'string' ? message.content.trim() : '';
}

/** Cheap, local summary — first sentence or a truncation. No model call (§4.8). */
export function summarizeTurn(text: string): string {
  const flat = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!flat) return '';
  const sentenceEnd = flat.search(/[.!?](\s|$)/);
  if (sentenceEnd !== -1 && sentenceEnd + 1 <= SUMMARY_MAX) {
    return flat.slice(0, sentenceEnd + 1);
  }
  return flat.length > SUMMARY_MAX
    ? `${flat.slice(0, SUMMARY_MAX - 1).trimEnd()}…`
    : flat;
}

/**
 * Pairs each user turn with the assistant turn that follows it, newest first,
 * capped. `ageRank` 0 = newest (drives opacity in the recency stack).
 */
export function buildRecap(
  messages: ConversationMessage[],
  cap: number = DEFAULT_RECAP_CAP,
): ConversationRecap {
  const pairs: Array<{ userId: string; ask: string; answer: string }> = [];
  let pendingUser: { id: string; text: string } | null = null;

  messages.forEach((message, index) => {
    const id = message.id ?? `m-${index}`;
    const text = messageText(message);
    if (message.role === 'user') {
      if (pendingUser) {
        pairs.push({
          userId: pendingUser.id,
          ask: pendingUser.text,
          answer: '',
        });
      }
      pendingUser = { id, text };
    } else if (message.role === 'assistant' && pendingUser) {
      pairs.push({
        userId: pendingUser.id,
        ask: pendingUser.text,
        answer: text,
      });
      pendingUser = null;
    }
  });
  if (pendingUser) {
    pairs.push({
      userId: (pendingUser as { id: string }).id,
      ask: (pendingUser as { text: string }).text,
      answer: '',
    });
  }

  return pairs
    .slice(-Math.max(0, cap))
    .reverse()
    .map((pair, ageRank) => ({
      messageId: pair.userId,
      askSummary: summarizeTurn(pair.ask),
      answerSummary: summarizeTurn(pair.answer),
      ageRank,
    }));
}

export function useRecap(
  messages: ConversationMessage[],
  cap: number = DEFAULT_RECAP_CAP,
): ConversationRecap {
  return useMemo(() => buildRecap(messages, cap), [messages, cap]);
}
