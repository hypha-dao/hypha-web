/** Voices gpt-4o-mini-tts can speak. Marin is the home / LIVE speaker. */
const SPEECH_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
]);

/**
 * Home speaker — same as LIVE Realtime (`OPENAI_REALTIME_VOICE` default).
 * Marin is the young, feminine, joyful voice on production. Do not swap to
 * shimmer/coral again; those were the circle that drifted from LIVE.
 * Home speech ignores a low deployed OPENAI_REALTIME_VOICE override.
 */
export const HOME_SPEECH_VOICE = 'marin';

/**
 * Tone for synthesized home speech. The words stay the chat script.
 * Lead with close, joyful warmth — not a serious briefing or distant host.
 * Keep breaths after full stops soft and short so the talk stays alive.
 * Ease into every opening so the first syllable is never clipped.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'You are a young woman talking with a close friend she is delighted to see. Sound joyful, warm, and near — a happy conversation, never serious, never distant, never like a host reading notes. Bright enthusiasm, light youthful feminine energy, easy everyday pace. Let the sentences flow into each other. After a full stop, only a soft short breath — about half a second, never a long silence. Smile in the voice; rise and fall naturally. Ease into the first word of every sentence so nothing is clipped or swallowed at the start. Do not slow down, do not announce, and do not sound like you are reading.';

export function resolveSpeechVoice(requested?: string | null): string {
  const voice = (
    requested?.trim() ||
    process.env.OPENAI_REALTIME_VOICE?.trim() ||
    HOME_SPEECH_VOICE
  ).toLowerCase();
  return SPEECH_VOICES.has(voice) ? voice : HOME_SPEECH_VOICE;
}

/** Home chat and home speech. Ignores OPENAI_REALTIME_VOICE. Matches LIVE. */
export function resolveHomeSpeechVoice(): string {
  return HOME_SPEECH_VOICE;
}
