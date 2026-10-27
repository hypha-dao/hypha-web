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

/** Tone for synthesized home speech. The words stay the chat script. */
export const SPEECH_TONE_INSTRUCTIONS =
  'Speak as a close friend in a community, glad they are here. Warm, soft, and unhurried. A little slower than everyday chat, with a natural pause between sentences, so the whole thought can land. Smile in the voice. Empathic and calm. Never urgent, never a newsreader, never corporate, never a checklist, and never falsely cheerful.';

export function resolveSpeechVoice(requested?: string | null): string {
  const voice = (
    requested?.trim() ||
    process.env.OPENAI_REALTIME_VOICE?.trim() ||
    'marin'
  ).toLowerCase();
  return SPEECH_VOICES.has(voice) ? voice : 'marin';
}
