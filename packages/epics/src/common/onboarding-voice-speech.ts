'use client';

import {
  removeMarkdownImageTokens,
  stripMarkdown,
} from '@hypha-platform/ui-utils';

/** Strip markdown and URLs so browser TTS reads naturally. */
export function stripMarkdownForSpeech(text: string): string {
  return stripMarkdown(removeMarkdownImageTokens(text))
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickPreferredVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof globalThis.speechSynthesis === 'undefined') return undefined;
  const voices = globalThis.speechSynthesis.getVoices();
  const langPrefix = lang.split('-')[0]?.toLowerCase() ?? 'en';
  const ranked = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(langPrefix),
  );
  const premium =
    ranked.find((voice) =>
      /samantha|daniel|karen|moira|fiona|google|natural|premium|enhanced/i.test(
        voice.name,
      ),
    ) ?? ranked[0];
  return premium ?? voices[0];
}

export function speakOnboardingText(
  text: string,
  options?: { lang?: string; rate?: number; onEnd?: () => void },
): (() => void) | null {
  if (typeof globalThis.speechSynthesis === 'undefined') return null;
  const spoken = stripMarkdownForSpeech(text);
  if (!spoken) return null;

  globalThis.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  const lang = options?.lang ?? document.documentElement.lang ?? 'en';
  utterance.lang = lang;
  utterance.rate = options?.rate ?? 0.95;
  utterance.pitch = 1;
  const voice = pickPreferredVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onEnd?.();
  globalThis.speechSynthesis.speak(utterance);

  return () => {
    globalThis.speechSynthesis.cancel();
  };
}

export function stopOnboardingSpeech(): void {
  if (typeof globalThis.speechSynthesis === 'undefined') return;
  globalThis.speechSynthesis.cancel();
}
