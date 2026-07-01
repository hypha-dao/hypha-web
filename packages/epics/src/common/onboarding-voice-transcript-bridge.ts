'use client';

import type { StoredOnboardingChatMessage } from './ai-onboarding-context';

export type VoiceTranscriptTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type VoiceBridgedChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
};

type ChatLikeMessage = {
  id: string;
  role: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  content?: string;
};

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_MAX_CHARS = 6000;

function normalizeTurnText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function createVoiceMessageId(role: VoiceTranscriptTurn['role']): string {
  return `voice-${role}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function extractTextFromChatLikeMessage(
  message: ChatLikeMessage,
): string {
  const partText = (message.parts ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
  if (partText) return partText;
  return typeof message.content === 'string' ? message.content.trim() : '';
}

export function extractTranscriptTurnsFromChatMessages(
  messages: ChatLikeMessage[],
): VoiceTranscriptTurn[] {
  const turns: VoiceTranscriptTurn[] = [];
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const text = extractTextFromChatLikeMessage(message);
    if (!text) continue;
    turns.push({ role: message.role, text });
  }
  return turns;
}

export function mergeAdjacentVoiceTranscriptTurns(
  turns: VoiceTranscriptTurn[],
): VoiceTranscriptTurn[] {
  const merged: VoiceTranscriptTurn[] = [];
  for (const turn of turns) {
    const text = normalizeTurnText(turn.text);
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = normalizeTurnText(`${last.text} ${text}`);
      continue;
    }
    merged.push({ role: turn.role, text });
  }
  return merged;
}

export function buildRecentTranscriptSummaryFromChatMessages(
  messages: ChatLikeMessage[],
  options?: { maxTurns?: number; maxChars?: number },
): string | undefined {
  const maxTurns = options?.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const merged = mergeAdjacentVoiceTranscriptTurns(
    extractTranscriptTurnsFromChatMessages(messages),
  );
  if (merged.length === 0) return undefined;

  const recent = merged.slice(-maxTurns);
  const lines = recent.map(
    (turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`,
  );

  let summary = lines.join('\n');
  if (summary.length > maxChars) {
    summary = summary.slice(summary.length - maxChars);
    const firstNewline = summary.indexOf('\n');
    if (firstNewline > 0) {
      summary = summary.slice(firstNewline + 1);
    }
  }

  return summary.trim() || undefined;
}

export function voiceTranscriptTurnToChatMessage(
  turn: VoiceTranscriptTurn,
  id = createVoiceMessageId(turn.role),
): VoiceBridgedChatMessage {
  return {
    id,
    role: turn.role,
    parts: [{ type: 'text', text: normalizeTurnText(turn.text) }],
  };
}

export function appendVoiceTranscriptTurn<T extends ChatLikeMessage>(
  messages: T[],
  turn: VoiceTranscriptTurn,
): T[] {
  const text = normalizeTurnText(turn.text);
  if (!text) return messages;

  const last = messages[messages.length - 1];
  if (last && last.role === turn.role) {
    const lastText = extractTextFromChatLikeMessage(last);
    if (lastText === text) return messages;
  }

  return [...messages, voiceTranscriptTurnToChatMessage(turn) as T];
}

export function toStoredOnboardingChatMessages(
  messages: ChatLikeMessage[],
): StoredOnboardingChatMessage[] {
  return messages
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    )
    .map((message) => ({
      id: message.id,
      role: message.role as StoredOnboardingChatMessage['role'],
      parts: message.parts?.length
        ? message.parts
        : extractTextFromChatLikeMessage(message)
        ? [{ type: 'text', text: extractTextFromChatLikeMessage(message) }]
        : [],
    }));
}
