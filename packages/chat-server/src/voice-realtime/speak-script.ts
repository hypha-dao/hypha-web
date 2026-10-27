import 'server-only';

import {
  MISSING_OPENAI_KEY_MESSAGE,
  RealtimeVoiceSessionError,
} from './session';
import { resolveSpeechVoice } from './speech-voice';

const SPEECH_MODEL = 'gpt-4o-mini-tts';

export { resolveSpeechVoice };

/**
 * Speak `text` as audio. This is synthesis, not a chat model: the bytes are
 * those words, and nothing else gets added.
 */
export async function synthesizeSpeechScript(
  text: string,
): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RealtimeVoiceSessionError(
      'missing_api_key',
      MISSING_OPENAI_KEY_MESSAGE,
    );
  }
  const input = text.trim().slice(0, 4000);
  if (!input) {
    throw new RealtimeVoiceSessionError(
      'invalid_response',
      'There is no script to speak.',
    );
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      voice: resolveSpeechVoice(),
      input,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RealtimeVoiceSessionError(
      'upstream_error',
      `Speech synthesis failed (${response.status}).${
        detail ? ` ${detail.slice(0, 180)}` : ''
      }`,
    );
  }

  return response.arrayBuffer();
}
