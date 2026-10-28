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
 * Home speaker. Shimmer is the young, enthusiastic feminine voice.
 * Coral was landing mature. A deployed OPENAI_REALTIME_VOICE is often a
 * low voice, so home speech does not use it. Do not push pitch in the
 * tone prompt — that made Shimmer sound strained.
 */
export const HOME_SPEECH_VOICE = 'shimmer';

/**
 * Tone for synthesized home speech. The words stay the chat script.
 * A slower pace and a pause after every sentence is what made this sound read out.
 * Naming pitch ("higher than a narrator") made the delivery unnatural.
 * Lead with joy so home speech feels like a pleasant moment, not a briefing.
 * Keep the beat after a full stop short (~1–2 seconds), not a long silence.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'You are a young woman talking with a friend she is genuinely happy to see. Speak with real joy and warm enthusiasm — a bright, pleasant moment, like good news shared lightly. Stay light and youthful feminine, at an easy everyday pace. Let the sentences flow into each other the way people actually talk. After a full stop, only a short breath of about one to two seconds — never a long silence. Smile in the voice; rise and fall naturally, nothing performed or announced. Do not slow down, and do not sound like you are reading.';

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
