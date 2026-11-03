'use client';

import './member-home-sent-tick.css';

/** Same confirmation mark as the wallet send flow. */
export function SentTick() {
  return (
    <span className="sent-tick text-foreground" aria-hidden>
      <svg viewBox="0 0 48 48">
        <circle className="sent-tick-ring" cx="24" cy="24" r="18" />
        <path className="sent-tick-mark" d="M15.5 24.5 L21.2 30.2 L33 17.5" />
      </svg>
    </span>
  );
}
