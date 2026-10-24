'use client';

/** TEMP(#2575): render-storm tracer, remove with the fix. */
import { useRef } from 'react';

const counts = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let window2575 = 0;

function ensureTimer() {
  if (timer || typeof window === 'undefined') return;
  timer = setInterval(() => {
    window2575 += 1;
    const rows = [...counts.entries()]
      .filter(([, n]) => n >= 4)
      .sort((a, b) => b[1] - a[1]);
    if (rows.length > 0) {
      console.log(
        `[#2575] top renderers (last 2s, window ${window2575})`,
        Object.fromEntries(rows),
      );
    }
    counts.clear();
  }, 2000);
}

/** Counts a component render. A summary of the busiest components is logged every 2 seconds. */
export function useRenderTrace2575(name: string) {
  ensureTimer();
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

/** Logs which of the given values changed identity since the previous render. */
export function useChangedTrace2575(
  name: string,
  values: Record<string, unknown>,
) {
  const previous = useRef<Record<string, unknown> | null>(null);
  if (previous.current) {
    const changed = Object.keys(values).filter(
      (key) => !Object.is(previous.current?.[key], values[key]),
    );
    if (changed.length > 0) {
      console.log(`[#2575] ${name} changed`, changed);
    }
  }
  previous.current = values;
}
