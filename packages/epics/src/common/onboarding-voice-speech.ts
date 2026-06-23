'use client';

import { resolveOnboardingSpeechLocale } from './onboarding-voice-locale';

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

const FORM_LABEL_LINE =
  /^(?:\d+[.)]\s*)?(?:\*\*)?(?:proposal\s+)?(?:title|description|entry\s+method|voting\s+method|quorum\s*(?:\(%\))?|unity\s*(?:\(%\))?|required\s+fields?|optional\s+fields?|next\s+step|walkthrough|discovery)(?:\*\*)?\s*[:.\-–—]/i;

function isSpokenNoiseSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return true;
  if (FORM_LABEL_LINE.test(trimmed)) return true;
  if (/^\d+[.)]\s/.test(trimmed)) return true;
  if (/^[-*•]\s/.test(trimmed)) return true;
  if (/^let'?s start with (?:the )?(?:required|following)/i.test(trimmed)) {
    return true;
  }
  if (/^please provide (?:a|the|your)/i.test(trimmed)) return true;
  if (/^can you (?:provide|describe|tell)/i.test(trimmed)) return true;
  if (/^what (?:specific|would you like)/i.test(trimmed)) return true;
  if (/^a brief explanation/i.test(trimmed)) return true;
  return false;
}

/**
 * Standard voice reads the assistant chat message word-for-word via Web Speech.
 * Drop form-like lines and keep a short human summary when the model slips.
 */
export function prepareAssistantTextForSpeech(text: string): string {
  const withoutImages = removeMarkdownImageTokens(text)
    .replace(/https?:\/\/\S+/g, '')
    .trim();
  if (!withoutImages) return '';

  const rawLines = withoutImages.split(/\n+/);
  const lines = rawLines
    .map((rawLine) => {
      const trimmedRaw = rawLine.trim();
      if (/^[-*•]\s/.test(trimmedRaw)) return '';
      return stripMarkdown(trimmedRaw).replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
  const lineFiltered = lines.filter((line) => !isSpokenNoiseSentence(line));

  const collapsed = lineFiltered.join(' ').replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';

  const sentences = collapsed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const spoken = sentences.filter(
    (sentence) => !isSpokenNoiseSentence(sentence),
  );

  if (spoken.length > 0) {
    return spoken.slice(0, 4).join(' ').trim();
  }

  // Don't read bare list fragments left after stripping form labels.
  if (!/[.!?]/.test(collapsed) && collapsed.split(/\s+/).length < 12) {
    return '';
  }

  return collapsed.slice(0, 320).trim();
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
  const spoken = prepareAssistantTextForSpeech(text);
  if (!spoken) return null;

  let cancelled = false;

  const speak = () => {
    if (cancelled) return;
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    const lang = resolveOnboardingSpeechLocale(
      options?.lang ?? document.documentElement.lang,
    );
    utterance.lang = lang;
    utterance.rate = options?.rate ?? 0.96;
    utterance.pitch = 1.08;
    utterance.volume = 0.98;
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
