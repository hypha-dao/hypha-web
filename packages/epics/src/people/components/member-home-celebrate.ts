'use client';

const SOUND_KEY = 'humai-sound';

function soundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

let shared: AudioContext | null = null;

/** One context for the HUMAI signature. Call from a user gesture. */
async function audioContext(): Promise<AudioContext | null> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  shared ??= new Ctor();
  if (shared.state === 'suspended') await shared.resume().catch(() => {});
  return shared;
}

let lastCelebration = 0;

export function motionShouldStaySilent(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * The HUMAI signature, played when something is done: a vote cast, a moment
 * held. Slightly softer than the opening, respects the mute, and never stacks
 * when two things finish in the same breath.
 *
 * Copied from the HUMAI ambience engine (`celebrate` + `playSignature`).
 * Reduced motion stays silent. Playback never throws to the caller.
 */
export function celebrate() {
  try {
    if (motionShouldStaySilent()) return;
    if (!soundPreference()) return;
    const now = Date.now();
    if (now - lastCelebration < 3000) return;
    lastCelebration = now;
    void playSignature({ level: 0.55 }).catch(() => {});
  } catch {
    // Sound never blocks the vote or the validation.
  }
}

/** The HUMAI+ signature: ~2.4 s. Resolves when the tail has faded. */
async function playSignature(opts?: { level?: number }): Promise<void> {
  const ctx = await audioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.05;

  const master = ctx.createGain();
  master.gain.setValueAtTime(opts?.level ?? 0.9, t0);
  master.connect(ctx.destination);

  // Sub swell — the circle expanding.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, t0);
  sub.frequency.exponentialRampToValueAtTime(110, t0 + 1.6);
  const subG = ctx.createGain();
  subG.gain.setValueAtTime(0.0001, t0);
  subG.gain.exponentialRampToValueAtTime(0.35, t0 + 0.6);
  subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
  sub.connect(subG).connect(master);
  sub.start(t0);
  sub.stop(t0 + 2.7);

  // Two glassy notes: "HU" then "MAI+" — a rising fifth, then the octave shimmer.
  const notes: Array<[number, number, number]> = [
    [220, 0, 1.6], // A3
    [329.63, 0.32, 1.9], // E4
    [440, 0.62, 2.2], // A4
    [659.25, 0.62, 1.6], // E5 shimmer
  ];
  for (const [freq, at, len] of notes) {
    // FM bell: carrier + modulator at 2x, bright attack that softens.
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * 2.01;
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 1.4, t0 + at);
    modG.gain.exponentialRampToValueAtTime(1, t0 + at + len);
    mod.connect(modG).connect(car.frequency);

    const g = ctx.createGain();
    const peak = freq > 500 ? 0.12 : 0.28;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);

    // A touch of stereo width via detuned twin.
    const twin = ctx.createOscillator();
    twin.type = 'sine';
    twin.frequency.value = freq;
    twin.detune.value = 6;
    const twinG = ctx.createGain();
    twinG.gain.value = 0.5;
    twin.connect(twinG).connect(g);

    car.connect(g).connect(master);
    car.start(t0 + at);
    twin.start(t0 + at);
    mod.start(t0 + at);
    car.stop(t0 + at + len + 0.1);
    twin.stop(t0 + at + len + 0.1);
    mod.stop(t0 + at + len + 0.1);
  }

  // Sparkle: a fast upward arpeggio of tiny sines.
  [880, 1108.73, 1318.51, 1760].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    const at = t0 + 0.7 + i * 0.09;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + 1);
  });

  await new Promise((r) => setTimeout(r, 2500));
}
