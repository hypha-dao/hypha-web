/** Voices gpt-4o-mini-tts can speak. Coral is the joyful home speaker. */
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
 * Home speaker for chat TTS and home Live Realtime.
 * Coral carries cheer and warmth; marin was reading too calm and distant.
 * Home speech ignores a low deployed OPENAI_REALTIME_VOICE override.
 */
export const HOME_SPEECH_VOICE = 'coral';

/**
 * Slight lift so the line feels alive, not dragged.
 * OpenAI accepts 0.25–4.0; 1.0 is the default.
 */
export const HOME_SPEECH_SPEED = 1.08;

/**
 * Tone for synthesized home speech. Keep this short and directive —
 * long essays made the delivery feel performed and serious. Words stay
 * the chat script.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'Speak in a bright, cheerful, joyful tone — warm and close, like a happy young woman talking with a friend she is glad to see. Upbeat and smiling. Easy everyday pace. Soft short breaths between sentences. Never serious, never distant, never flat, never like a host or a briefing. Ease into the first word so nothing is clipped.';

export function resolveSpeechVoice(requested?: string | null): string {
  const voice = (
    requested?.trim() ||
    process.env.OPENAI_REALTIME_VOICE?.trim() ||
    HOME_SPEECH_VOICE
  ).toLowerCase();
  return SPEECH_VOICES.has(voice) ? voice : HOME_SPEECH_VOICE;
}

/** Home chat and home speech. Ignores OPENAI_REALTIME_VOICE. */
export function resolveHomeSpeechVoice(): string {
  return HOME_SPEECH_VOICE;
}
