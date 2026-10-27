/** Voices gpt-4o-mini-tts can speak. Coral is the home speaker. */
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

/** Home speaker. Warm and conversational, rather than a low neutral read. */
export const HOME_SPEECH_VOICE = 'coral';

/**
 * Tone for synthesized home speech. The words stay the chat script.
 * A slower pace and a pause after every sentence is what made this sound read out.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'You are a woman talking with a friend. Soft, warm, and close, at an easy everyday pace. Let the sentences flow into each other, the way people actually talk. Light rises and falls, nothing performed. Glad they are here. Do not slow down, and do not announce.';

export function resolveSpeechVoice(requested?: string | null): string {
  const voice = (
    requested?.trim() ||
    process.env.OPENAI_REALTIME_VOICE?.trim() ||
    HOME_SPEECH_VOICE
  ).toLowerCase();
  return SPEECH_VOICES.has(voice) ? voice : HOME_SPEECH_VOICE;
}
