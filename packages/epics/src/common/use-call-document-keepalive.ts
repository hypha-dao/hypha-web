'use client';

import { useEffect } from 'react';
import { resumeCallPlayback } from './human-chat-panel/call-playback-registry';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

/**
 * Keep mic/WebRTC alive when the Hypha tab is backgrounded — especially with
 * Document Picture-in-Picture, where the main document is still `hidden`.
 */
export function useCallDocumentKeepalive(
  active: boolean,
  documentPipOpen: boolean,
) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    let wakeLock: WakeLockSentinelLike | null = null;
    let audioContext: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;

    const startSilentKeepalive = () => {
      if (audioContext) return;
      try {
        audioContext = new AudioContext();
        oscillator = audioContext.createOscillator();
        gain = audioContext.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        void audioContext.resume();
      } catch {
        // Web Audio unavailable
      }
    };

    const stopSilentKeepalive = () => {
      try {
        oscillator?.stop();
      } catch {
        // already stopped
      }
      oscillator = null;
      gain = null;
      void audioContext?.close();
      audioContext = null;
    };

    const onWakeLockReleased = () => {
      wakeLock = null;
      if (active) {
        void requestWakeLock();
      }
    };

    const requestWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (type: 'screen') => Promise<WakeLockSentinelLike>;
          };
        };
        if (nav.wakeLock?.request) {
          wakeLock = await nav.wakeLock.request('screen');
          wakeLock.addEventListener?.('release', onWakeLockReleased);
        }
      } catch {
        // unsupported or denied
      }
    };

    const releaseWakeLock = () => {
      wakeLock?.removeEventListener?.('release', onWakeLockReleased);
      void wakeLock?.release().catch(() => undefined);
      wakeLock = null;
    };

    const onVisibility = () => {
      if (document.hidden || documentPipOpen) {
        startSilentKeepalive();
        void audioContext?.resume();
        void resumeCallPlayback();
        return;
      }
      stopSilentKeepalive();
      void requestWakeLock();
      void resumeCallPlayback();
    };

    void requestWakeLock();
    if (document.hidden || documentPipOpen) {
      startSilentKeepalive();
    }

    void resumeCallPlayback();

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopSilentKeepalive();
      releaseWakeLock();
    };
  }, [active, documentPipOpen]);

  useEffect(() => {
    if (!active) return;
    void resumeCallPlayback();
  }, [active, documentPipOpen]);
}
