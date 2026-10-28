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

/**
 * Home speaker. Coral is the feminine, conversational voice.
 * A deployed OPENAI_REALTIME_VOICE is often a low voice, so home speech
 * does not use it. Shimmer was coming out male and strained.
 */
export const HOME_SPEECH_VOICE = 'coral';

/**
 * Tone for synthesized home speech. The words stay the chat script.
 * A slower pace and a pause after every sentence is what made this sound read out.
 * Pushing the pitch "higher than a narrator" made it unnatural.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'You are a woman talking with a friend. Bright, warm, and lively, at an easy everyday pace. Keep a light feminine voice. Let the sentences flow into each other, the way people actually talk. Rise and fall naturally, nothing performed. Glad they are here. Do not slow down, and do not announce.';

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
