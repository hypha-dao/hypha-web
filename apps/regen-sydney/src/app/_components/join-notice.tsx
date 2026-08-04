'use client';

import { Sparkles, X } from 'lucide-react';

import { formatNumber, useCampaign } from '../_lib/campaign-store';

/** Shown once after a first sign-in, when the joining bonus is minted. */
export function JoinNotice() {
  const { user, balance, dismissJoinNotice } = useCampaign();

  if (!user?.joinedNow) return null;

  return (
    <div className="bg-[var(--rs-teal)] px-5 py-3 text-[var(--rs-white)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="rs-ui flex items-center gap-2.5 text-sm">
          <Sparkles size={16} className="shrink-0 text-[var(--rs-aqua)]" />
          <span>
            Welcome, {user.name.split(' ')[0]} —{' '}
            <strong className="rs-tabular">{formatNumber(balance)} RSUT</strong>{' '}
            were minted to your wallet {user.wallet}.
          </span>
        </p>
        <button
          type="button"
          onClick={dismissJoinNotice}
          aria-label="Dismiss"
          className="rs-focus shrink-0 rounded-full p-1 text-[hsl(0_0%_100%/0.7)] transition-colors hover:text-[var(--rs-white)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
