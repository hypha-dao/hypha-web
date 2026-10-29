'use client';

/**
 * Soft incoming-message chime — a quieter, shorter cousin of the HUMAI
 * celebrate signature (see `member-home-celebrate.ts`). Web Audio only so CSP
 * stays happy; fails quietly when autoplay is blocked.
 */

const SOUND_KEY = 'humai-sound';
const LEGACY_SOUND_KEY = 'hypha-member-home-sound';

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

/**
 * Soft two-note ping (~0.35s). Debounced so a burst of messages does not stack.
 */
export function playMessageReceiveSound(): void {
  try {
    if (typeof window === 'undefined') return;
    if (motionShouldStaySilent()) return;
    if (!soundPreference()) return;
    if (document.visibilityState !== 'visible') return;
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
