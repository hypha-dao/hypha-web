'use client';

import { useEffect, useState } from 'react';

import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';

function useCountdown(endsAt: string) {
  // Rendered only after mount so the server and client never disagree on the clock.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (now === null) return null;

  const remaining = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
    ended: remaining === 0,
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="rs-heading rs-tabular text-2xl leading-none sm:text-3xl">
        {String(value).padStart(2, '0')}
      </div>
      <div className="rs-eyebrow mt-1.5 text-[var(--rs-teal)]">{label}</div>
    </div>
  );
}

export function CycleStrip() {
  const { cycle, totalPotAud, contributions } = useCampaign();
  const countdown = useCountdown(cycle.endsAt);

  return (
    <section className="bg-[var(--rs-aqua)] px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="rs-eyebrow text-[var(--rs-teal)]">Voting closes in</p>
          {countdown ? (
            <div className="mt-3 flex gap-6">
              <Unit value={countdown.days} label="Days" />
              <Unit value={countdown.hours} label="Hrs" />
              <Unit value={countdown.minutes} label="Min" />
              <Unit value={countdown.seconds} label="Sec" />
            </div>
          ) : (
            <div className="rs-heading mt-3 text-2xl sm:text-3xl">&mdash;</div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3">
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">Community</dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">
              {formatAud(cycle.communityPotAud)}
            </dd>
          </div>
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">Matched</dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">
              {formatAud(cycle.communityPotAud)}
            </dd>
          </div>
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">Total pot</dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">
              {formatAud(totalPotAud)}
            </dd>
          </div>
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">Contributors</dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">
              {formatNumber(cycle.contributors)}
            </dd>
          </div>
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">
              Latest donation
            </dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">
              {contributions[0]
                ? formatAud(contributions[0].amountAud)
                : formatAud(0)}
            </dd>
          </div>
          <div>
            <dt className="rs-eyebrow text-[var(--rs-teal)]">Rate</dt>
            <dd className="rs-heading rs-tabular mt-1 text-xl">A$1 = 1 RSUT</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
