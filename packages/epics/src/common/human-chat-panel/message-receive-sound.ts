'use client';

import { EventType, type MatrixEvent } from 'matrix-js-sdk';

/**
 * Soft incoming-message chime — a quieter, shorter cousin of the HUMAI
 * celebrate signature (see `member-home-celebrate.ts`). Web Audio only so CSP
 * stays happy; fails quietly when autoplay is blocked.
 *
 * Played for **live** messages from someone else in any joined room (Messages
 * badge listeners), not when opening a thread. When the tab is backgrounded
 * the browser may still block audio — OneSignal `chat.message` push covers
 * that case with an OS notification sound.
 */

const SOUND_KEY = 'humai-sound';
const LEGACY_SOUND_KEY = 'hypha-member-home-sound';

/** Ignore decrypt catch-up for older encrypted history when opening a room. */
const RECENT_MESSAGE_MS = 20_000;

const HIDDEN_MESSAGE_FLAGS = [
  'io.hypha.call.session_anchor.v1',
  'io.hypha.call.raise_hand.v1',
  'io.hypha.screenshare_takeover.v1',
  'io.hypha.call_capture_notice.v1',
] as const;

function soundPreference(): boolean {
  try {
    if (window.localStorage.getItem(SOUND_KEY) === 'off') return false;
    if (window.localStorage.getItem(LEGACY_SOUND_KEY) === 'off') return false;
    return true;
  } catch {
    return true;
  }
}

function motionShouldStaySilent(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

let shared: AudioContext | null = null;
let lastPlayedAt = 0;

function audioContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  shared ??= new Ctor();
  if (shared.state === 'suspended') void shared.resume().catch(() => {});
  return shared;
}

/** Exported for unit tests — live receive chime eligibility. */
export function isIncomingConversationMessage(
  event: MatrixEvent,
  selfId: string | null | undefined,
): boolean {
  if (event.getType() !== EventType.RoomMessage) return false;
  if (event.isRedacted()) return false;
  const sender = event.getSender() || event.sender?.userId || '';
  if (!sender) return false;
  if (selfId && sender === selfId) return false;
  const content = event.getContent() as Record<string, unknown> | undefined;
  const relates = content?.['m.relates_to'] as
    | { rel_type?: string }
    | undefined;
  if (relates?.rel_type === 'm.replace') return false;
  if (content?.msgtype === 'm.notice') return false;
  if (HIDDEN_MESSAGE_FLAGS.some((flag) => content?.[flag] === true)) {
    return false;
  }
  const body = typeof content?.body === 'string' ? content.body : '';
  if (body.includes('[hypha:signal-team')) return false;
  return Boolean(event.getId());
}

/**
 * Soft two-note ping (~0.35s). Debounced so a burst of messages does not stack.
 */
export function playMessageReceiveSound(): void {
  try {
    if (typeof window === 'undefined') return;
    if (motionShouldStaySilent()) return;
    if (!soundPreference()) return;
    const now = Date.now();
    if (now - lastPlayedAt < 450) return;
    lastPlayedAt = now;
    const ctx = audioContext();
    if (!ctx) return;
    void playSoftPing(ctx).catch(() => {});
  } catch {
    // Sound never blocks chat.
  }
}

/**
 * Play for a Matrix timeline / decrypt event when it is a live message from
 * someone else. Skips history pagination and sync catch-up.
 */
export function playMessageReceiveSoundForEvent(
  event: MatrixEvent,
  selfId: string | null | undefined,
  options?: {
    toStartOfTimeline?: boolean;
    liveEvent?: boolean;
    /** When true, only play if the event timestamp is recent (decrypt path). */
    requireRecent?: boolean;
  },
): void {
  if (options?.toStartOfTimeline) return;
  if (options?.liveEvent === false) return;
  if (options?.requireRecent) {
    const age = Date.now() - event.getTs();
    if (!Number.isFinite(age) || age < 0 || age > RECENT_MESSAGE_MS) return;
  }
  if (!isIncomingConversationMessage(event, selfId)) return;
  playMessageReceiveSound();
}

async function playSoftPing(ctx: AudioContext): Promise<void> {
  const t0 = ctx.currentTime + 0.01;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.22, t0);
  master.connect(ctx.destination);

  // Rising fifth — same interval family as celebrate, much shorter / quieter.
  const notes: Array<[number, number, number]> = [
    [440, 0, 0.28], // A4
    [659.25, 0.08, 0.32], // E5
  ];
  for (const [freq, at, len] of notes) {
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    car.connect(g).connect(master);
    car.start(t0 + at);
    car.stop(t0 + at + len + 0.05);
  }

  await new Promise((r) => setTimeout(r, 400));
}
