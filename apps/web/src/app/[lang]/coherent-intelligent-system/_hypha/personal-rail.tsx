'use client';

import * as React from 'react';
import {
  Activity,
  BatteryMedium,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

/**
 * #2486 M10 — the personal wellbeing rail. A permanent column to the right of
 * the canvas, about the *member* rather than the organization: a "life quality"
 * read, a few sub-indicators, and quick mood logging.
 *
 * v0 is a direction the team will explore, not a real model: it keeps a simple
 * mood log in `localStorage` (no backend, only this device) and derives the
 * meters from it. Everything else is representative.
 */

const MOOD_LOG_KEY = 'hypha:coherent:v1:mood-log';
const MOOD_LEVELS = ['Low', 'So-so', 'OK', 'Good', 'Great'] as const;

type MoodEntry = { level: number; ts: number };

function readLog(): MoodEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MOOD_LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (e): e is MoodEntry =>
            !!e && typeof e.level === 'number' && typeof e.ts === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

function writeLog(entries: MoodEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MOOD_LOG_KEY,
      JSON.stringify(entries.slice(-60)),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Rolling average (0..1) of the last `n` entries, or a resting default. */
function rollingScore(
  entries: MoodEntry[],
  n: number,
  fallback: number,
): number {
  const recent = entries.slice(-n);
  if (recent.length === 0) return fallback;
  const avg = recent.reduce((sum, e) => sum + e.level, 0) / recent.length / 5;
  return Math.min(1, Math.max(0, avg));
}

function scoreLabel(score: number): string {
  if (score < 0.3) return 'Strained';
  if (score < 0.5) return 'Uneven';
  if (score < 0.7) return 'Steady';
  if (score < 0.85) return 'Good';
  return 'Thriving';
}

function Meter({
  icon: Icon,
  label,
  score,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  score: number;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-2 text-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-4">
        <div
          className="h-full rounded-full bg-accent-9 transition-[width] duration-500"
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function PersonalRail({ className }: { className?: string }) {
  const [log, setLog] = React.useState<MoodEntry[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setLog(readLog());
    setHydrated(true);
  }, []);

  const record = React.useCallback((level: number) => {
    setLog((prev) => {
      const next = [...prev, { level, ts: Date.now() }];
      writeLog(next);
      return next;
    });
  }, []);

  const lifeQuality = rollingScore(log, 8, 0.6);
  const mood = rollingScore(log, 3, 0.6);
  const latestLevel = log.at(-1)?.level ?? null;

  return (
    <aside
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-background-2 p-5',
        className,
      )}
      aria-label="Personal wellbeing"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-3 font-semibold text-foreground [font-family:var(--font-family-heading)]">
          Life quality
        </h3>
        <Activity className="size-4 text-muted-foreground" />
      </div>

      {/* Headline gauge */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-2">
          <span className="text-muted-foreground">This week</span>
          <span className="font-medium text-accent-11">
            {scoreLabel(lifeQuality)}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--accent-4),var(--accent-9))]">
          <div
            className="absolute top-1/2 size-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-accent-9 bg-white transition-[left] duration-500"
            style={{ left: `${Math.round(lifeQuality * 100)}%` }}
          />
        </div>
      </div>

      {/* Sub-indicators */}
      <div className="flex flex-col gap-3">
        <Meter
          icon={Sparkles}
          label="Mood"
          score={mood}
          hint={scoreLabel(mood)}
        />
        <Meter icon={BatteryMedium} label="Energy" score={0.55} hint="Fair" />
        <Meter icon={Users} label="Connection" score={0.32} hint="Low" />
      </div>

      {/* Quick mood log */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-2 text-muted-foreground">
          How&rsquo;s your mood right now?
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {MOOD_LEVELS.map((label, i) => {
            const level = i + 1;
            const active = hydrated && latestLevel === level;
            return (
              <button
                key={label}
                type="button"
                onClick={() => record(level)}
                aria-label={label}
                title={label}
                className={cn(
                  'grid place-items-center rounded-chrome border py-2 transition-colors',
                  active
                    ? 'border-accent-8 bg-accent-3 text-accent-11'
                    : 'border-border bg-background text-muted-foreground hover:border-accent-7 hover:text-foreground',
                )}
              >
                <MoodFace level={level} />
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="self-start text-2 font-medium text-accent-11 hover:text-accent-12"
      >
        Give more detailed feedback &rarr;
      </button>
      <p className="text-1 text-muted-foreground">
        Personal — a direction we&rsquo;re exploring. Only you see this, stored
        on this device.
      </p>
    </aside>
  );
}

/** A 5-step stroked face: frown → flat → slight → smile → big smile. */
function MoodFace({ level }: { level: number }) {
  const mouth =
    level === 1
      ? 'M8 15c1.5-1.5 6.5-1.5 8 0'
      : level === 2
      ? 'M8 15h8'
      : level === 3
      ? 'M8 14c1.5 1 6.5 1 8 0'
      : level === 4
      ? 'M8 13c1.5 2.5 6.5 2.5 8 0'
      : 'M7 12c2 4 8 4 10 0';
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d={mouth} />
      <line x1="9" y1="10" x2="9.01" y2="10" />
      <line x1="15" y1="10" x2="15.01" y2="10" />
    </svg>
  );
}
