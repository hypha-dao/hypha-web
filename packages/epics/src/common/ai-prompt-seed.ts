'use client';

export const AI_PROMPT_SEED_EVENT = 'hypha:ai-prompt-seed';
export const AI_CHAT_MIRROR_EVENT = 'hypha:ai-chat-mirror';
export const AI_VOICE_START_EVENT = 'hypha:ai-voice-start';

export type AiPromptSeedDetail = {
  prompt: string;
};

export type AiChatMirrorMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export type AiChatMirrorDetail = {
  messages: AiChatMirrorMessage[];
  status: 'ready' | 'submitted' | 'streaming' | 'error' | string;
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

export function dispatchAiChatMirror(detail: AiChatMirrorDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AiChatMirrorDetail>(AI_CHAT_MIRROR_EVENT, {
      detail,
    }),
  );
}

export function dispatchAiVoiceStart(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AI_VOICE_START_EVENT));
}
