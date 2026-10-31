'use client';

import { EventType, type MatrixEvent, type Room } from 'matrix-js-sdk';

/**
 * Soft incoming-message chime — a quieter, shorter cousin of the HUMAI
 * celebrate signature (see `member-home-celebrate.ts`). Web Audio only so CSP
 * stays happy; fails quietly when autoplay is blocked.
 *
 * Played for **live** messages from someone else in any joined room (Messages
 * badge listeners), not when opening a thread. Policy:
 * - Skip history / sync catch-up (`liveEvent: false`, pagination).
 * - Skip when the tab is hidden (another device / app is in front).
 * - Skip events older than {@link RECENT_MESSAGE_MS} (laptop wake catch-up).
 * - Skip when this account already read past the event (other-device receipt).
 * - Coalesce bursts so a night of messages is one ping, not one per event.
 *
 * When the tab is backgrounded the browser may still block audio — OneSignal
 * `chat.message` push covers that case with an OS notification sound.
 */

const SOUND_KEY = 'humai-sound';
const LEGACY_SOUND_KEY = 'hypha-member-home-sound';

/** Ignore decrypt / wake catch-up for older encrypted history. */
export const RECENT_MESSAGE_MS = 30_000;

/**
 * After a ping, stay silent this long so a burst of live messages (or a reconnect
 * flood) does not stack into a ringtone.
 */
export const RECEIVE_SOUND_COOLDOWN_MS = 4_000;

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

function documentAllowsSound(): boolean {
  if (typeof document === 'undefined') return false;
  // Hidden tab / locked screen / other app in front — OS push covers alerts.
  return document.visibilityState === 'visible';
}

let shared: AudioContext | null = null;
let lastPlayedAt = 0;

/** Test helper — reset coalesce clock between cases. */
export function resetMessageReceiveSoundCooldownForTests(): void {
  lastPlayedAt = 0;
}

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
 * True when this account's read cursor is already at or past the event — e.g.
 * the member read the thread on mobile before this browser played a chime.
 */
export function isMessageAlreadyReadBySelf(
  room: Room | null | undefined,
  event: MatrixEvent,
  selfId: string | null | undefined,
): boolean {
  if (!room || !selfId) return false;
  const eventId = event.getId();
  if (!eventId) return false;
  const readId = room.getEventReadUpTo(selfId, false);
  if (readId && readId === eventId) return true;

  let readTs = 0;
  if (readId) {
    readTs = room.findEventById(readId)?.getTs() ?? 0;
  }
  const raw = room.getLastUnthreadedReceiptFor(selfId) as
    | { ts?: number; data?: { ts?: number } }
    | undefined;
  const fromReceipt =
    typeof raw?.ts === 'number'
      ? raw.ts
      : typeof raw?.data?.ts === 'number'
      ? raw.data.ts
      : 0;
  readTs = Math.max(readTs, fromReceipt);
  if (readTs <= 0) return false;
  const eventTs = event.getTs();
  return Number.isFinite(eventTs) && eventTs > 0 && eventTs <= readTs;
}

export function isMessageRecentEnoughForReceiveSound(
  event: MatrixEvent,
  nowMs: number = Date.now(),
): boolean {
  const age = nowMs - event.getTs();
  return Number.isFinite(age) && age >= 0 && age <= RECENT_MESSAGE_MS;
}

/**
 * Soft two-note ping (~0.35s). Cooldown so a burst of messages does not stack.
 */
export function playMessageReceiveSound(): void {
  try {
    if (typeof window === 'undefined') return;
    if (motionShouldStaySilent()) return;
    if (!soundPreference()) return;
    if (!documentAllowsSound()) return;
    const now = Date.now();
    if (now - lastPlayedAt < RECEIVE_SOUND_COOLDOWN_MS) return;
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
 * someone else. Skips history pagination, sync catch-up, hidden tabs, stale
 * wake floods, and events already read on another device.
 */
export function playMessageReceiveSoundForEvent(
  event: MatrixEvent,
  selfId: string | null | undefined,
  options?: {
    toStartOfTimeline?: boolean;
    liveEvent?: boolean;
    room?: Room | null;
    /**
     * @deprecated Prefer always-on age gate via {@link RECENT_MESSAGE_MS}.
     * Kept so older call sites still type-check; ignored (age always applies).
     */
    requireRecent?: boolean;
  },
): void {
  if (options?.toStartOfTimeline) return;
  if (options?.liveEvent === false) return;
  if (!isMessageRecentEnoughForReceiveSound(event)) return;
  if (!isIncomingConversationMessage(event, selfId)) return;
  if (isMessageAlreadyReadBySelf(options?.room, event, selfId)) return;
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
