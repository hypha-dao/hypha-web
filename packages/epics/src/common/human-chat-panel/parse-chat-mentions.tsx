import type { ReactNode } from 'react';

export type MentionSegment =
  | { type: 'text'; start: number; end: number }
  | {
      type: 'pill';
      start: number;
      end: number;
      label: string;
      mxid: string;
    }
  | { type: 'mxid'; start: number; end: number; display: string };

const MAX_SCAN = 50_000;
/** Max chars after `@` to search for ` <@mxid>` — avoids O(n²) on repeated `@`. */
const MAX_PILL_LOOKAHEAD = 512;

function isMxidLocalpartChar(c: string): boolean {
  return /[0-9a-zA-Z._=/+-]/.test(c);
}

function isDomainChar(c: string): boolean {
  return /[0-9a-zA-Z.-]/.test(c);
}

/**
 * Linear-time mention parse (no backtracking regex — CodeQL-safe) for
 * `@Label <@mxid>` and Matrix `@localpart:server`.
 */
export function parseMentionSegments(text: string): MentionSegment[] {
  if (text.length > MAX_SCAN) {
    return [{ type: 'text', start: 0, end: text.length }];
  }
  const out: MentionSegment[] = [];
  let segStart = 0;
  let i = 0;
  const n = text.length;

  const tryPill = (
    at: number,
  ): { end: number; label: string; mxid: string } | null => {
    const jMax = Math.min(n - 3, at + 1 + MAX_PILL_LOOKAHEAD);
    let j = at + 1;
    while (j <= jMax) {
      if (text[j] === ' ' && text[j + 1] === '<' && text[j + 2] === '@') {
        const mxidStart = j + 3;
        const mxidScanEnd = Math.min(n, mxidStart + 256);
        let close = mxidStart;
        while (close < mxidScanEnd && text[close] !== '>') close += 1;
        if (close < n && text[close] === '>') {
          const mxid = text.slice(mxidStart, close);
          if (mxid.includes(':') && mxid.length > 0 && mxid.length <= 255) {
            const label = text.slice(at + 1, j).trim();
            return {
              end: close + 1,
              label: label.length > 0 ? label : mxid,
              mxid,
            };
          }
        }
        return null;
      }
      j += 1;
    }
    return null;
  };

  const tryPlainMxid = (at: number): { end: number } | null => {
    let k = at + 1;
    if (k >= n || !isMxidLocalpartChar(text[k]!)) return null;
    while (k < n && isMxidLocalpartChar(text[k]!)) k += 1;
    if (k >= n || text[k] !== ':') return null;
    k += 1;
    const hostStart = k;
    while (k < n && isDomainChar(text[k]!)) k += 1;
    if (k === hostStart) return null;
    const boundary = k < n ? text[k] : '';
    if (boundary && !/[\s.,!?;:]/.test(boundary)) return null;
    return { end: k };
  };

  while (i < n) {
    if (text[i] !== '@') {
      i += 1;
      continue;
    }
    const at = i;
    if (at > segStart) {
      out.push({ type: 'text', start: segStart, end: at });
    }

    const pill = tryPill(at);
    if (pill) {
      out.push({
        type: 'pill',
        start: at,
        end: pill.end,
        label: pill.label,
        mxid: pill.mxid,
      });
      i = pill.end;
      segStart = i;
      continue;
    }

    const plain = tryPlainMxid(at);
    if (plain) {
      out.push({
        type: 'mxid',
        start: at,
        end: plain.end,
        display: text.slice(at, plain.end),
      });
      i = plain.end;
      segStart = i;
      continue;
    }

    i += 1;
  }
  if (n > segStart) {
    out.push({ type: 'text', start: segStart, end: n });
  }
  return out;
}

export function renderTextWithMentionsFromSegments(
  text: string,
  segments: MentionSegment[],
): ReactNode[] {
  const parts: ReactNode[] = [];
  let key = 0;
  for (const s of segments) {
    if (s.type === 'text') {
      const chunk = text.slice(s.start, s.end);
      if (chunk) parts.push(chunk);
      continue;
    }
    if (s.type === 'pill') {
      parts.push(
        <span
          key={`m-${key++}`}
          className="bg-primary/20 text-primary rounded px-1 font-medium"
          title={s.mxid}
        >
          @{s.label}
        </span>,
      );
    } else {
      parts.push(
        <span
          key={`m-${key++}`}
          className="bg-primary/20 text-primary rounded px-1 font-medium"
          title={s.display}
        >
          {s.display}
        </span>,
      );
    }
  }
  return parts;
}
