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

/** Warm, empathic feminine voices — earlier entries rank higher per locale. */
const PREFERRED_FEMININE_VOICE_PARTS = [
  'samantha',
  'karen',
  'moira',
  'fiona',
  'victoria',
  'allison',
  'ava',
  'serena',
  'tessa',
  'kate',
  'susan',
  'sonia',
  'jenny',
  'aria',
  'zira',
  'hazel',
  'google uk english female',
  'google us english female',
  'google portugu',
  'google español',
  'google francais',
  'google deutsch',
  'female',
  'natural',
  'premium',
  'enhanced',
];

const MASCULINE_VOICE_PARTS = [
  'daniel',
  'alex',
  'fred',
  'ralph',
  'bruce',
  'tom',
  'mark',
  'david',
  'jorge',
  'male',
];

function voiceMatchesLanguage(
  voice: SpeechSynthesisVoice,
  lang: string,
): boolean {
  const target = lang.toLowerCase();
  const voiceLang = voice.lang.toLowerCase();
  const langPrefix = target.split('-')[0] ?? target;
  return voiceLang === target || voiceLang.startsWith(`${langPrefix}-`);
}

function isMasculineVoiceName(name: string): boolean {
  const normalized = name.toLowerCase();
  return MASCULINE_VOICE_PARTS.some((part) => normalized.includes(part));
}

function scoreFeminineVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (isMasculineVoiceName(name)) return -100;

  let score = 0;
  for (
    let index = 0;
    index < PREFERRED_FEMININE_VOICE_PARTS.length;
    index += 1
  ) {
    const part = PREFERRED_FEMININE_VOICE_PARTS[index]!;
    if (name.includes(part)) {
      score += 100 - index;
    }
  }
  if (voice.localService) score += 5;
  if (name.includes('female')) score += 4;
  if (/natural|premium|enhanced|neural/i.test(name)) score += 3;
  return score;
}

function pickWarmFeminineVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof globalThis.speechSynthesis === 'undefined') return undefined;
  const voices = globalThis.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;

  const langMatches = voices.filter((voice) =>
    voiceMatchesLanguage(voice, lang),
  );
  const pool = langMatches.length > 0 ? langMatches : voices;
  const ranked = [...pool].sort(
    (a, b) => scoreFeminineVoice(b) - scoreFeminineVoice(a),
  );

  const best = ranked.find((voice) => scoreFeminineVoice(voice) > 0);
  return best ?? ranked[0];
}

export function speakOnboardingText(
  text: string,
  options?: { lang?: string; rate?: number; onEnd?: () => void },
): (() => void) | null {
  if (typeof globalThis.speechSynthesis === 'undefined') return null;
  const spoken = stripMarkdownForSpeech(text);
  if (!spoken) return null;

  let cancelled = false;

  const speak = () => {
    if (cancelled) return;
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    const lang = options?.lang ?? document.documentElement.lang ?? 'en';
    utterance.lang = lang;
    utterance.rate = options?.rate ?? 0.92;
    utterance.pitch = 1.03;
    utterance.volume = 0.96;
    const voice = pickWarmFeminineVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => options?.onEnd?.();
    utterance.onerror = () => options?.onEnd?.();
    globalThis.speechSynthesis.speak(utterance);
  };

  const voices = globalThis.speechSynthesis.getVoices();
  if (voices.length > 0) {
    speak();
  } else {
    const onVoicesChanged = () => {
      globalThis.speechSynthesis.removeEventListener(
        'voiceschanged',
        onVoicesChanged,
      );
      speak();
    };
    globalThis.speechSynthesis.addEventListener(
      'voiceschanged',
      onVoicesChanged,
    );
  }

  return () => {
    cancelled = true;
    globalThis.speechSynthesis.cancel();
  };
}

export function stopOnboardingSpeech(): void {
  if (typeof globalThis.speechSynthesis === 'undefined') return;
  globalThis.speechSynthesis.cancel();
}
