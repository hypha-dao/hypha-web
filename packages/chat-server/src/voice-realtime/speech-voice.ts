/** Voices gpt-4o-mini-tts can speak. Shimmer is the soft home speaker. */
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
 * Shimmer is soft and close. Marin read too calm; coral sounded performed
 * and weird with the cheer instructions. Home speech ignores a low
 * deployed OPENAI_REALTIME_VOICE override.
 */
export const HOME_SPEECH_VOICE = 'shimmer';

/**
 * Slight lift so the line feels alive, not dragged.
 * OpenAI accepts 0.25–4.0; 1.0 is the default.
 */
export const HOME_SPEECH_SPEED = 1.05;

/**
 * Tone for synthesized home speech. Keep this short and directive —
 * long essays and stacked cheer made the delivery feel performed.
 * Words stay the chat script.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'Speak warmly and naturally, like a young woman talking with a friend she likes. Soft, close, and easy. Everyday pace. Soft short breaths between sentences. Never serious, never distant, never flat, never like a host or a briefing. Do not sound performed or cartoonish. Ease into the first word so nothing is clipped.';

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
