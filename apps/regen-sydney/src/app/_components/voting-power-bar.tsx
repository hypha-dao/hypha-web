'use client';

import { AlertCircle, Check, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { formatNumber, useCampaign } from '../_lib/campaign-store';
import { RsButton } from './ui';

/**
 * Sticky footer bar that appears once you are signed in — the running total of
 * how much voting weight you have placed, and the only place the ballot is
 * actually committed to the server.
 */
export function VotingPowerBar() {
  const {
    user,
    balance,
    allocated,
    remaining,
    resetAllocations,
    saveVotes,
    saving,
    dirty,
    cycle,
    error,
  } = useCampaign();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!user) return null;

  const pct = balance > 0 ? (allocated / balance) * 100 : 0;
  const votingClosed = cycle.status !== 'open';

  return (
    <div className="sticky bottom-0 z-30 border-t border-[var(--rs-line)] bg-[var(--rs-white)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="rs-ui mb-2 flex items-baseline justify-between gap-4 text-xs sm:justify-start sm:gap-8">
            <span className="text-[var(--rs-ink-soft)]">
              <span className="rs-heading rs-tabular mr-1.5 text-base">
                {formatNumber(allocated)}
              </span>
              of {formatNumber(balance)} RSUT allocated
            </span>
            <span
              className={
                remaining > 0
                  ? 'text-[var(--rs-clay)]'
                  : 'text-[var(--rs-teal)]'
              }
            >
              {remaining > 0
                ? `${formatNumber(remaining)} still to place`
                : 'All tokens placed'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rs-cream-deep)] sm:max-w-md">
            <div
              className="h-full rounded-full bg-[var(--rs-clay)] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {error ? (
            <p className="rs-ui mt-2 flex items-center gap-1.5 text-xs text-[var(--rs-clay)]">
              <AlertCircle size={12} /> {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={resetAllocations}
            disabled={allocated === 0 || saving}
            className="rs-eyebrow rs-focus inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[var(--rs-ink-faint)] transition-colors hover:text-[var(--rs-ink)] disabled:opacity-30"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <RsButton
            size="sm"
            disabled={!dirty || saving || votingClosed}
            onClick={async () => {
              const ok = await saveVotes();
              if (ok) setSaved(true);
            }}
          >
            {votingClosed ? (
              'Voting closed'
            ) : saving ? (
              'Saving…'
            ) : saved ? (
              <>
                <Check size={14} /> Votes saved
              </>
            ) : (
              'Save my votes'
            )}
          </RsButton>
        </div>
      </div>
    </div>
  );
}
