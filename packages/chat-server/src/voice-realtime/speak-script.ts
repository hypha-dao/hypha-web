import 'server-only';

import {
  MISSING_OPENAI_KEY_MESSAGE,
  RealtimeVoiceSessionError,
} from './session';
import {
  HOME_SPEECH_SPEED,
  resolveHomeSpeechVoice,
  resolveSpeechVoice,
  SPEECH_TONE_INSTRUCTIONS,
} from './speech-voice';

const SPEECH_MODEL = 'gpt-4o-mini-tts';

/** OpenAI `pcm` is 24 kHz mono signed 16-bit little-endian. */
export const SPEECH_PCM_SAMPLE_RATE = 24_000;

export { resolveHomeSpeechVoice, resolveSpeechVoice };

async function openSpeechStream(text: string): Promise<Response> {
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

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        voice: resolveHomeSpeechVoice(),
        input,
        instructions: SPEECH_TONE_INSTRUCTIONS,
        speed: HOME_SPEECH_SPEED,
        // Raw PCM streams immediately; mp3 forced a full-file wait before play.
        response_format: 'pcm',
      }),
    });
  } catch (error) {
    throw new RealtimeVoiceSessionError(
      'upstream_error',
      error instanceof Error ? error.message : 'OpenAI speech request failed',
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RealtimeVoiceSessionError(
      'upstream_error',
      `Speech synthesis failed (${response.status}).${
        detail ? ` ${detail.slice(0, 180)}` : ''
      }`,
    );
  }

  return response;
}

/**
 * Speak `text` as audio. This is synthesis, not a chat model: the bytes are
 * those words, and nothing else gets added.
 */
export async function synthesizeSpeechScript(
  text: string,
): Promise<ArrayBuffer> {
  const response = await openSpeechStream(text);
  return response.arrayBuffer();
}

/** Streams OpenAI TTS PCM so the client can start playback before the full clip arrives. */
export async function streamSpeechScript(
  text: string,
): Promise<ReadableStream<Uint8Array>> {
  const response = await openSpeechStream(text);
  if (!response.body) {
    throw new RealtimeVoiceSessionError(
      'invalid_response',
      'OpenAI speech returned an empty body',
    );
  }
  return response.body;
}
