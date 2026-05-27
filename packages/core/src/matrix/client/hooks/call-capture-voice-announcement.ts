import type { SpaceGroupCallCaptureMode } from './space-group-call-state';

export type CallCaptureVoiceAction = 'started' | 'stopped';

export type CallCaptureVoiceAnnouncementParams = {
  action: CallCaptureVoiceAction;
  mode: Exclude<SpaceGroupCallCaptureMode, 'none'>;
};

export type GetCallCaptureVoiceAnnouncement = (
  params: CallCaptureVoiceAnnouncementParams,
) => string | null | undefined;

const PREFERRED_VOICE_NAME_PARTS = [
  'samantha',
  'karen',
  'victoria',
  'google uk english female',
  'google us english',
  'microsoft zira',
  'microsoft aria',
  'moira',
  'fiona',
  'tessa',
  'amelie',
  'anna',
  'helena',
  'paulina',
];

function resolveAnnouncementLanguage(): string {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang?.trim();
    if (lang) return lang;
  }
  if (typeof navigator !== 'undefined') {
    return navigator.language?.trim() || 'en';
  }
  return 'en';
}

function voiceMatchesLanguage(
  voice: SpeechSynthesisVoice,
  lang: string,
): boolean {
  const target = lang.toLowerCase();
  const voiceLang = voice.lang.toLowerCase();
  return (
    voiceLang === target || voiceLang.startsWith(`${target.split('-')[0]}-`)
  );
}

function pickAnnouncementVoice(
  lang: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const langMatches = voices.filter((voice) =>
    voiceMatchesLanguage(voice, lang),
  );
  const pool = langMatches.length > 0 ? langMatches : voices;
  const ranked = [...pool].sort((a, b) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const name = voice.name.toLowerCase();
      let value = 0;
      for (let i = 0; i < PREFERRED_VOICE_NAME_PARTS.length; i += 1) {
        if (name.includes(PREFERRED_VOICE_NAME_PARTS[i]!)) {
          value += 100 - i;
        }
      }
      if (voice.localService) value += 5;
      if (name.includes('female')) value += 3;
      return value;
    };
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}

/** Short spoken notice when call capture starts or stops (Zoom-style compliance cue). */
export function speakCallCaptureVoiceAnnouncement(
  text: string | null | undefined,
  lang = resolveAnnouncementLanguage(),
) {
  if (
    typeof window === 'undefined' ||
    typeof window.speechSynthesis === 'undefined'
  ) {
    return;
  }
  const message = text?.trim();
  if (!message) return;

  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = lang;
    utterance.rate = 0.93;
    utterance.pitch = 1.02;
    utterance.volume = 0.92;
    const voice = pickAnnouncementVoice(
      lang,
      window.speechSynthesis.getVoices(),
    );
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    speak();
    return;
  }

  const onVoicesChanged = () => {
    window.speechSynthesis.removeEventListener(
      'voiceschanged',
      onVoicesChanged,
    );
    speak();
  };
  window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
}
