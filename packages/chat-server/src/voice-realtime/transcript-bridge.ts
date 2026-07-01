export type VoiceTranscriptTurn = {
  role: 'user' | 'assistant';
  text: string;
};

const DEFAULT_MAX_TURNS = 12;
const DEFAULT_MAX_CHARS = 6000;

function normalizeTurnText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Merge adjacent turns from the same speaker (Realtime can emit fragments). */
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

/**
 * Compact recent voice/chat turns for Realtime session instructions.
 * Used when switching from chat → voice so the model keeps context.
 */
export function buildRecentTranscriptSummary(
  turns: VoiceTranscriptTurn[],
  options?: { maxTurns?: number; maxChars?: number },
): string | undefined {
  const maxTurns = options?.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const merged = mergeAdjacentVoiceTranscriptTurns(turns);
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
