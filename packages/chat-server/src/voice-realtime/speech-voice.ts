/** Voices gpt-4o-mini-tts can speak. Marin is the home speaker. */
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

export function resolveSpeechVoice(requested?: string | null): string {
  const voice = (
    requested?.trim() ||
    process.env.OPENAI_REALTIME_VOICE?.trim() ||
    'marin'
  ).toLowerCase();
  return SPEECH_VOICES.has(voice) ? voice : 'marin';
}
