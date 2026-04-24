'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** @see docs/requirements/voice-video-call-implementation-spec.md §1.2.1 */
const LS_KEY = 'hypha.callJoinAlertSound';

export function readCallJoinSoundPreferenceFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === '0' || v === 'false') return false;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  return true;
}

export function persistCallJoinSoundPreference(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const CHIME_MAX_MS = 3000;

/**
 * Short two-part chime (Web Audio). No file asset — easy CSP; stops graph when done.
 * Fails quietly if Autoplay is blocked.
 */
export function playCallJoinChime(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const ACN = window.AudioContext;
  if (!ACN) return Promise.resolve();

  const Ctx = ACN;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.12;
  master.connect(ctx.destination);

  const beep = (start: number, freq: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.4, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + 0.22);
  };

  return ctx
    .resume()
    .catch(() => undefined)
    .then(() => {
      if (ctx.state === 'closed' || ctx.state === 'suspended') {
        void ctx.close();
        return;
      }
      const t0 = ctx.currentTime + 0.01;
      beep(t0, 523.25);
      beep(t0 + 0.1, 659.25);
      beep(t0 + 0.4, 523.25);
      beep(t0 + 0.5, 659.25);
      window.setTimeout(() => {
        void ctx.close();
      }, CHIME_MAX_MS);
    });
}

const NOTIFICATION_TAG = 'hypha-notify-space-call-join';
/** Deduplicate Strict-Mode remounts + rapid re-renders; ~one chime per join “edge”. */
const lastChimeAtByRoom = new Map<string, number>();
const DEDUPE_MS = 4500;

export type UseCallJoinChimeOptions = {
  callUiEnabled: boolean;
  roomId: string | null;
  /** When true: others are in the room GroupCall; local user idle (see showRoomCallInProgress). */
  showJoinOpportunity: boolean;
  /** Device count in room call; used for background notification text. */
  roomCallDeviceCount: number;
  /** i18n strings for one-shot `Notification` when the tab is hidden. */
  notification: { title: string; body: string };
  /** @default true — respect localStorage in browser */
  readPreferenceOnMount?: boolean;
};

/**
 * Plays a throttled chime at most **once** per "join opportunity" (strip becomes visible
 * for this room) and optionally shows a one-shot `Notification` when the tab is hidden.
 */
export function useCallJoinChime({
  callUiEnabled,
  roomId,
  showJoinOpportunity,
  roomCallDeviceCount,
  notification,
  readPreferenceOnMount = true,
}: UseCallJoinChimeOptions): {
  joinAlertSoundEnabled: boolean;
  setJoinAlertSoundEnabled: (enabled: boolean) => void;
} {
  const [joinAlertSoundEnabled, setState] = useState(true);

  useEffect(() => {
    if (!readPreferenceOnMount) return;
    setState(readCallJoinSoundPreferenceFromStorage());
  }, [readPreferenceOnMount]);

  const setJoinAlertSoundEnabled = useCallback((enabled: boolean) => {
    setState(enabled);
    persistCallJoinSoundPreference(enabled);
  }, []);

  const prevShowJoinRef = useRef(false);
  const [opportunityEpoch, setOpportunityEpoch] = useState(0);
  const lastChimedEpochRef = useRef(0);
  const notificationTextRef = useRef(notification);
  notificationTextRef.current = notification;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (roomIdRef.current !== roomId) {
      /* New room: allow a fresh join edge + chime; do not zero opportunityEpoch
         (that would block the chime effect until showJoinOpportunity flips). */
      prevShowJoinRef.current = false;
      lastChimedEpochRef.current = 0;
    }
  }, [roomId]);

  useEffect(() => {
    const was = prevShowJoinRef.current;
    prevShowJoinRef.current = showJoinOpportunity;
    if (showJoinOpportunity && !was) {
      setOpportunityEpoch((e) => e + 1);
    }
  }, [showJoinOpportunity]);

  useEffect(() => {
    if (!callUiEnabled || !roomId) return;
    if (!showJoinOpportunity) return;
    if (opportunityEpoch === 0) return;
    if (opportunityEpoch === lastChimedEpochRef.current) return;

    const rid = roomIdRef.current;
    if (rid) {
      const t = lastChimeAtByRoom.get(rid) ?? 0;
      if (Date.now() - t < DEDUPE_MS) {
        lastChimedEpochRef.current = opportunityEpoch;
        return;
      }
      lastChimeAtByRoom.set(rid, Date.now());
    }
    lastChimedEpochRef.current = opportunityEpoch;

    const showBrowserNotification = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const n = notificationTextRef.current;
      new Notification(n.title, {
        body: n.body,
        tag: `${NOTIFICATION_TAG}-${roomIdRef.current ?? 'none'}`,
        silent: true,
      });
    };

    const docHidden = document.visibilityState === 'hidden';
    if (docHidden) {
      showBrowserNotification();
    }
    if (joinAlertSoundEnabled) {
      void playCallJoinChime();
    }
  }, [
    callUiEnabled,
    roomId,
    showJoinOpportunity,
    opportunityEpoch,
    joinAlertSoundEnabled,
  ]);

  return { joinAlertSoundEnabled, setJoinAlertSoundEnabled };
}
