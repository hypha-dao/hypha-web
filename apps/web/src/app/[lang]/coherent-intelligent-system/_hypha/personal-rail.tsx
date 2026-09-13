'use client';

import * as React from 'react';
import {
  Activity,
  BatteryMedium,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

/**
 * #2486 M10 — the personal rail. A permanent column to the right of the canvas,
 * about the *member* rather than the organization: a "life quality" read, an
 * events calendar across the member's spaces, and a few at-a-glance stats.
 *
 * v0 is a direction the team will explore, not a real model — mock data
 * throughout, and the only persisted state is a mood log in `localStorage`
 * (no backend, only this device). Host-owned: the IO never places or touches it.
 */
export function PersonalRail({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <LifeQualityCard />
      <EventsCalendarCard />
      <SpaceStatsCard />
    </div>
  );
}

function RailCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-background-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-2 font-semibold text-foreground [font-family:var(--font-family-heading)]">
          <Icon className="size-3.5 text-muted-foreground" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ Life quality */

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
      <div className="flex items-center justify-between text-1 text-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3 text-muted-foreground" />
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

function LifeQualityCard() {
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
    <RailCard title="Life quality" icon={Activity}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-1">
          <span className="text-muted-foreground">This week</span>
          <span className="font-medium text-accent-11">
            {scoreLabel(lifeQuality)}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--accent-4),var(--accent-9))]">
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-9 bg-white transition-[left] duration-500"
            style={{ left: `${Math.round(lifeQuality * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Meter
          icon={Sparkles}
          label="Mood"
          score={mood}
          hint={scoreLabel(mood)}
        />
        <Meter icon={BatteryMedium} label="Energy" score={0.55} hint="Fair" />
        <Meter icon={Users} label="Connection" score={0.32} hint="Low" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-1 text-muted-foreground">
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
                  'grid place-items-center rounded-chrome border py-1.5 transition-colors',
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

      <p className="text-1 text-muted-foreground">
        Personal — a direction we&rsquo;re exploring. Only you see this, stored
        on this device.
      </p>
    </RailCard>
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
      width="16"
      height="16"
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

/* --------------------------------------------------------------- Events calendar */

/** Mock: the spaces the member belongs to, each with a dot colour. */
const MOCK_SPACES = [
  { name: 'Hypha ecosystem', dot: 'bg-accent-9' },
  { name: 'ger test video 032', dot: 'bg-info-9' },
  { name: 'Coherence guild', dot: 'bg-success-9' },
  { name: 'Treasury circle', dot: 'bg-warning-9' },
] as const;

/** Mock: day-of-month → indices into MOCK_SPACES with an event that day. */
const MOCK_EVENTS: Record<number, number[]> = {
  3: [0],
  8: [1, 2],
  9: [0],
  14: [3],
  15: [0, 1],
  17: [2],
  22: [0, 3],
  24: [1],
  28: [0, 2, 3],
};

function EventsCalendarCard() {
  const [monthOffset, setMonthOffset] = React.useState(0);
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const isCurrentMonth = monthOffset === 0;
  const today = base.getDate();

  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <RailCard
      title="Events"
      icon={CalendarDays}
      action={
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonthOffset((o) => o - 1)}
            className="grid size-5 place-items-center rounded-chrome hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-[5.5rem] text-center text-1 font-medium text-foreground">
            {view.toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonthOffset((o) => o + 1)}
            className="grid size-5 place-items-center rounded-chrome hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-muted-foreground">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day == null) return <span key={i} />;
          const events = MOCK_EVENTS[day] ?? [];
          const isToday = isCurrentMonth && day === today;
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5"
              title={
                events.length
                  ? events.map((s) => MOCK_SPACES[s]?.name).join(', ')
                  : undefined
              }
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-1 tabular-nums',
                  isToday
                    ? 'bg-accent-9 font-semibold text-white'
                    : 'text-foreground',
                )}
              >
                {day}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {events.slice(0, 3).map((s, k) => (
                  <span
                    key={k}
                    className={cn(
                      'size-1 rounded-full',
                      MOCK_SPACES[s]?.dot ?? 'bg-muted-foreground',
                    )}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-2.5">
        {MOCK_SPACES.map((s) => (
          <span
            key={s.name}
            className="flex items-center gap-1.5 text-1 text-muted-foreground"
          >
            <span className={cn('size-1.5 rounded-full', s.dot)} />
            <span className="truncate">{s.name}</span>
          </span>
        ))}
      </div>
    </RailCard>
  );
}

/* ----------------------------------------------------------------- Space stats */

const MOCK_STATS = [
  { label: 'Active signals', value: 12 },
  { label: 'My spaces', value: 4 },
  { label: 'Open agreements', value: 3 },
  { label: 'People near you', value: 28 },
] as const;

function SpaceStatsCard() {
  return (
    <RailCard title="At a glance" icon={Activity}>
      <div className="grid grid-cols-2 gap-2">
        {MOCK_STATS.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-0.5 rounded-chrome border border-border bg-background p-2.5"
          >
            <span className="text-4 font-semibold tabular-nums text-foreground [font-family:var(--font-family-heading)]">
              {s.value}
            </span>
            <span className="text-1 leading-tight text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </RailCard>
  );
}
