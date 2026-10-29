/** Voices gpt-4o-mini-tts can speak. Marin is the LIVE Realtime speaker. */
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
 * Home / LIVE speaker — same as production Realtime
 * (`OPENAI_REALTIME_VOICE` default). Keep marin; shimmer/coral and TTS
 * tone/speed overrides are what drifted the home voice away from LIVE.
 * Home speech ignores a low deployed OPENAI_REALTIME_VOICE override.
 */
export const HOME_SPEECH_VOICE = 'marin';

/**
 * Default OpenAI pace. Speeding TTS up was one of the rhythm drifts from LIVE.
 * OpenAI accepts 0.25–4.0; 1.0 is the default.
 */
export const HOME_SPEECH_SPEED = 1;

/**
 * Tone for synthesized speech fallback only. LIVE home speaks through
 * Realtime with its own "warm natural tone" instruction — keep this aligned,
 * not a separate cheer script.
 */
export const SPEECH_TONE_INSTRUCTIONS =
  'Speak the text verbatim with a warm natural tone. Do not add words.';

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
