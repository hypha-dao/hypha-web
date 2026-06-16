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
 * Short four-beep chime (two rising pairs, Web Audio) at t0, t0+0.1s, t0+0.4s, t0+0.5s.
 * No file asset — easy CSP; stops the graph when done. Fails quietly if Autoplay is blocked.
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
const CALL_JOIN_NAV_PREFIX = 'hypha-call-join-nav-';
/** One chime per room while a call episode is active (cleared after join strip hides). */
const activeChimeEpisodeByRoom = new Map<string, boolean>();
const STABLE_RISE_MS = 500;
const EPISODE_CLEAR_MS = 3000;

export type CallJoinNotificationTarget = {
  lang: string;
  spaceSlug: string;
  roomId: string;
  signalSlug?: string | null;
};

export function buildCallJoinHref(target: CallJoinNotificationTarget): string {
  const params = new URLSearchParams();
  params.set('joinCall', '1');
  const signalSlug = target.signalSlug?.trim();
  if (signalSlug) {
    params.set('signal', signalSlug);
  }
  return `/${target.lang}/dho/${target.spaceSlug}?${params.toString()}`;
}

function persistCallJoinNavigationTarget(
  target: CallJoinNotificationTarget,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${CALL_JOIN_NAV_PREFIX}${target.roomId.trim()}`,
      JSON.stringify(target),
    );
  } catch {
    /* ignore */
  }
}

export type UseCallJoinChimeOptions = {
  callUiEnabled: boolean;
  roomId: string | null;
  /** When true: others are in the room GroupCall; local user idle (see showRoomCallInProgress). */
  showJoinOpportunity: boolean;
  /** Device count in room call; used for background notification text. */
  roomCallDeviceCount: number;
  /** i18n strings for one-shot `Notification` when the tab is hidden. */
  notification: { title: string; body: string };
  /** Deep link when the user clicks the browser notification. */
  notificationTarget?: CallJoinNotificationTarget | null;
  /** Skip chime while Matrix is reconnecting (prevents loops on M_UNKNOWN_TOKEN). */
  matrixSessionReady?: boolean;
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
  notificationTarget = null,
  matrixSessionReady = true,
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

  const [opportunityEpoch, setOpportunityEpoch] = useState(0);
  const lastChimedEpochRef = useRef(0);
  const notificationTextRef = useRef(notification);
  notificationTextRef.current = notification;
  const notificationTargetRef = useRef(notificationTarget);
  notificationTargetRef.current = notificationTarget;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (roomIdRef.current !== roomId) {
      lastChimedEpochRef.current = 0;
    }
  }, [roomId]);

  useEffect(() => {
    const rid = roomId?.trim();
    if (!showJoinOpportunity) {
      const clearTimer = window.setTimeout(() => {
        if (rid) activeChimeEpisodeByRoom.delete(rid);
      }, EPISODE_CLEAR_MS);
      return () => window.clearTimeout(clearTimer);
    }

    const riseTimer = window.setTimeout(() => {
      if (!showJoinOpportunity) return;
      const stableRoomId = roomIdRef.current?.trim();
      if (!stableRoomId) return;
      if (activeChimeEpisodeByRoom.get(stableRoomId)) return;
      activeChimeEpisodeByRoom.set(stableRoomId, true);
      setOpportunityEpoch((epoch) => epoch + 1);
    }, STABLE_RISE_MS);

    return () => window.clearTimeout(riseTimer);
  }, [showJoinOpportunity, roomId]);

  useEffect(() => {
    if (!callUiEnabled || !roomId || !matrixSessionReady) return;
    if (!showJoinOpportunity) return;
    if (opportunityEpoch === 0) return;
    if (opportunityEpoch === lastChimedEpochRef.current) return;

    lastChimedEpochRef.current = opportunityEpoch;

    const target = notificationTargetRef.current;
    if (target?.roomId?.trim() && target.spaceSlug?.trim()) {
      persistCallJoinNavigationTarget(target);
    }

    const showBrowserNotification = () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const n = notificationTextRef.current;
      const navTarget = notificationTargetRef.current;
      const href =
        navTarget?.spaceSlug?.trim() && navTarget.lang?.trim()
          ? buildCallJoinHref(navTarget)
          : null;
      const instance = new Notification(n.title, {
        body: n.body,
        tag: `${NOTIFICATION_TAG}-${roomIdRef.current ?? 'none'}`,
        silent: true,
      });
      if (href) {
        instance.onclick = () => {
          window.focus();
          instance.close();
          window.location.assign(href);
        };
      }
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
    matrixSessionReady,
    roomCallDeviceCount,
  ]);

  return { joinAlertSoundEnabled, setJoinAlertSoundEnabled };
}
