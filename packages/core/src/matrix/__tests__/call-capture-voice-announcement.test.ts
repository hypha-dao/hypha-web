import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakCallCaptureVoiceAnnouncement } from '../client/hooks/call-capture-voice-announcement';

describe('call-capture-voice-announcement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('speaks trimmed announcement text when speech synthesis is available', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    const getVoices = vi.fn(() => [
      {
        name: 'Samantha',
        lang: 'en-US',
        localService: true,
      },
    ]);

    class MockSpeechSynthesisUtterance {
      text = '';
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(message: string) {
        this.text = message;
      }
    }

    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak,
        cancel,
        getVoices,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    speakCallCaptureVoiceAnnouncement('  Recording has started.  ', 'en-US');

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe('Recording has started.');
    expect(utterance.lang).toBe('en-US');
    expect(utterance.rate).toBeCloseTo(0.93);
    expect(utterance.voice?.name).toBe('Samantha');
  });

  it('ignores empty announcements', () => {
    const speak = vi.fn();
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak,
        cancel: vi.fn(),
        getVoices: vi.fn(() => []),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    speakCallCaptureVoiceAnnouncement('   ');

    expect(speak).not.toHaveBeenCalled();
  });
});
