/** Voices gpt-4o-mini-tts can speak. Shimmer is the home speaker. */
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
 * Home speaker. Shimmer sits higher than coral. A deployed
 * OPENAI_REALTIME_VOICE is often a low voice, so home speech does not use it.
 */
export const HOME_SPEECH_VOICE = 'shimmer';

/**
 * Tone for synthesized home speech. The words stay the chat script.
 * A slower pace and a pause after every sentence is what made this sound read out.
 * "Soft and close" was landing as a low voice, so the pitch is named here.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'You are a woman with a light, bright voice, higher than a narrator. Warm and close, at an easy everyday pace. Not a deep voice, not a low voice, and not a male voice. Let the sentences flow into each other, the way people actually talk. Light rises and falls, nothing performed. Glad they are here. Do not slow down, and do not announce.';

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
