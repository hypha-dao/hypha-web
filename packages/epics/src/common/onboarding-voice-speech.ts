'use client';

import { resolveOnboardingSpeechLocale } from './onboarding-voice-locale';

import {
  removeMarkdownImageTokens,
  stripMarkdown,
} from '@hypha-platform/ui-utils';

/** Spoken voice replies are capped to this many sentences (matches server prompts). */
export const MAX_VOICE_SPOKEN_SENTENCES = 4;

const VOICE_INTERIM_ACK_PHRASES_BY_LOCALE: Record<string, readonly string[]> = {
  en: [
    'One moment, let me check that for you.',
    'Give me a second to look into that.',
    'Let me pull that up for you.',
  ],
  fr: [
    'Un instant, je vérifie ça pour vous.',
    'Laissez-moi une seconde pour regarder.',
    'Je consulte ça tout de suite.',
  ],
  pt: [
    'Um momento, vou verificar isso para você.',
    'Me dê um segundo para consultar.',
    'Deixa eu buscar isso para você.',
  ],
  es: [
    'Un momento, déjame revisar eso por ti.',
    'Dame un segundo para consultarlo.',
    'Voy a buscar eso ahora mismo.',
  ],
  de: [
    'Einen Moment, ich schaue das für Sie nach.',
    'Geben Sie mir eine Sekunde, ich prüfe das.',
    'Ich rufe das gleich für Sie ab.',
  ],
  mk: [
    'Само момент, ќе го проверам тоа за вас.',
    'Дајте ми секунда да погледнам.',
    'Веднаш ќе го најдам тоа за вас.',
  ],
  nl: [
    'Een moment, ik zoek dat voor u op.',
    'Geef me even om dat te checken.',
    'Ik haal dat meteen voor u op.',
  ],
};

function resolveInterimAckLocale(locale?: string): string {
  const normalized = locale?.trim().toLowerCase().split('-')[0] ?? 'en';
  return normalized in VOICE_INTERIM_ACK_PHRASES_BY_LOCALE ? normalized : 'en';
}

/** Short filler when tools run before the model emits speakable text. */
export function pickVoiceInterimAckPhrase(locale?: string): string {
  const phrases =
    VOICE_INTERIM_ACK_PHRASES_BY_LOCALE[resolveInterimAckLocale(locale)] ??
    VOICE_INTERIM_ACK_PHRASES_BY_LOCALE.en!;
  const index = Math.floor(Math.random() * phrases.length);
  return phrases[index] ?? phrases[0]!;
}

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
  if (
    /^it looks like (?:i|we) need/i.test(trimmed) ||
    /^i now need to/i.test(trimmed) ||
    /^i(?:'ll| will) need to/i.test(trimmed) ||
    /^i need to (?:add|draft|collect|ask)/i.test(trimmed) ||
    /^let me add/i.test(trimmed) ||
    /^first,? i need to/i.test(trimmed) ||
    /^it seems i need/i.test(trimmed) ||
    /^looking at this/i.test(trimmed) ||
    /^the proposal.*(?:now )?complete/i.test(trimmed) ||
    /^you can review.*click publish/i.test(trimmed)
  ) {
    return true;
  }
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
    return spoken.slice(0, MAX_VOICE_SPOKEN_SENTENCES).join(' ').trim();
  }

  // Don't read bare list fragments left after stripping form labels.
  if (!/[.!?]/.test(collapsed) && collapsed.split(/\s+/).length < 12) {
    return '';
  }

  return collapsed.slice(0, 240).trim();
}

/** Sentence-sized chunks for graceful interrupt (finish current sentence, skip the rest). */
export function prepareAssistantSpeechSentences(text: string): string[] {
  const speakable = prepareAssistantTextForSpeech(text);
  if (!speakable) return [];
  const sentences = speakable.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 0) return sentences;
  return [speakable];
}

/** Rough duration for scheduling mic pre-warm before TTS ends. */
export function estimateSpeechDurationMs(text: string, rate = 1.02): number {
  const spoken = prepareAssistantTextForSpeech(text);
  if (!spoken) return 0;
  const words = spoken.split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 175 * rate;
  return Math.round((words / wordsPerMinute) * 60_000) + 80;
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

export type SpeechPlaybackController = {
  /** Stop immediately (disconnect / mode switch). */
  cancel: () => void;
  /** Finish the current sentence, then stop before any following sentences. */
  requestGracefulStop: () => void;
};

function speakSingleUtterance(
  text: string,
  options: { lang?: string; rate?: number; onEnd?: () => void },
): (() => void) | null {
  if (typeof globalThis.speechSynthesis === 'undefined') return null;
  const spoken = text.trim();
  if (!spoken) return null;

  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    const utterance = new SpeechSynthesisUtterance(spoken);
    const lang = resolveOnboardingSpeechLocale(
      options.lang ?? document.documentElement.lang,
    );
    utterance.lang = lang;
    utterance.rate = options.rate ?? 1.02;
    utterance.pitch = 1.08;
    utterance.volume = 0.98;
    const voice = pickWarmFeminineVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (!cancelled) options.onEnd?.();
    };
    utterance.onerror = () => {
      if (!cancelled) options.onEnd?.();
    };
    globalThis.speechSynthesis.speak(utterance);
  };

  const voices = globalThis.speechSynthesis.getVoices();
  if (voices.length > 0) {
    run();
  } else {
    const onVoicesChanged = () => {
      globalThis.speechSynthesis.removeEventListener(
        'voiceschanged',
        onVoicesChanged,
      );
      run();
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

export function speakOnboardingTextControlled(
  text: string,
  options?: { lang?: string; rate?: number; onEnd?: () => void },
): SpeechPlaybackController | null {
  if (typeof globalThis.speechSynthesis === 'undefined') return null;
  const sentences = prepareAssistantSpeechSentences(text);
  if (sentences.length === 0) return null;

  let cancelled = false;
  let gracefulStop = false;
  let sentenceIndex = 0;
  let currentCancel: (() => void) | null = null;

  const finish = () => {
    currentCancel = null;
    if (!cancelled) options?.onEnd?.();
  };

  const speakNext = () => {
    if (cancelled) return;
    if (gracefulStop || sentenceIndex >= sentences.length) {
      finish();
      return;
    }

    globalThis.speechSynthesis.cancel();
    const sentence = sentences[sentenceIndex]!;
    sentenceIndex += 1;
    currentCancel = speakSingleUtterance(sentence, {
      lang: options?.lang,
      rate: options?.rate,
      onEnd: () => {
        currentCancel = null;
        speakNext();
      },
    });
    if (!currentCancel) {
      finish();
    }
  };

  speakNext();

  return {
    cancel: () => {
      cancelled = true;
      currentCancel?.();
      currentCancel = null;
      stopOnboardingSpeech();
    },
    requestGracefulStop: () => {
      gracefulStop = true;
    },
  };
}

export function speakOnboardingText(
  text: string,
  options?: { lang?: string; rate?: number; onEnd?: () => void },
): (() => void) | null {
  const controller = speakOnboardingTextControlled(text, options);
  return controller?.cancel ?? null;
}

export function stopOnboardingSpeech(): void {
  if (typeof globalThis.speechSynthesis === 'undefined') return;
  globalThis.speechSynthesis.cancel();
}
