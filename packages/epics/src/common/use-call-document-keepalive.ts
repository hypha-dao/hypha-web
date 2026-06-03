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
 * CSH-MESH-7/8: wake lock only while hidden or PiP is open.
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
      if (active && (document.hidden || documentPipOpen)) {
        void requestWakeLock();
      }
    };

    const requestWakeLock = async () => {
      if (!document.hidden && !documentPipOpen) return;
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

    const syncBackgroundKeepalive = () => {
      const backgrounded = document.hidden || documentPipOpen;
      if (backgrounded) {
        startSilentKeepalive();
        void audioContext?.resume();
        void requestWakeLock();
        void resumeCallPlayback();
        return;
      }
      stopSilentKeepalive();
      releaseWakeLock();
      void resumeCallPlayback();
    };

    syncBackgroundKeepalive();
    document.addEventListener('visibilitychange', syncBackgroundKeepalive);

    return () => {
      document.removeEventListener('visibilitychange', syncBackgroundKeepalive);
      stopSilentKeepalive();
      releaseWakeLock();
    };
  }, [active, documentPipOpen]);

  useEffect(() => {
    if (!active) return;
    void resumeCallPlayback();
  }, [active, documentPipOpen]);
}
