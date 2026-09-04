'use client';

export const AI_PROMPT_SEED_EVENT = 'hypha:ai-prompt-seed';

export type AiPromptSeedDetail = {
  prompt: string;
};

export function dispatchAiPromptSeed(prompt: string): void {
  if (typeof window === 'undefined') return;
  const text = prompt.trim();
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent<AiPromptSeedDetail>(AI_PROMPT_SEED_EVENT, {
      detail: { prompt: text },
    }),
  );
}
