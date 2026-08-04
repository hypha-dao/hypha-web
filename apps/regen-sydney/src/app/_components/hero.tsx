'use client';

import { ArrowRight } from 'lucide-react';

import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';
import { JOIN_BONUS_RSUT } from '../_lib/mock-data';
import { Pill, RsButton } from './ui';

export function Hero({
  onContribute,
  onSignIn,
}: {
  onContribute: () => void;
  onSignIn: () => void;
}) {
  const { user, cycle, totalPotAud } = useCampaign();

  return (
    <section className="relative overflow-hidden bg-[var(--rs-cream)] px-5 pb-20 pt-16 sm:pt-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/media/spiral.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-24 hidden w-[38rem] opacity-25 lg:block"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Pill tone="peach">
            Round {cycle.number} &middot; {cycle.name}
          </Pill>

          <h1 className="rs-heading mt-6 text-4xl leading-[1.12] sm:text-5xl lg:text-6xl">
            Fund the projects
            <br />
            regenerating Sydney
          </h1>

          <p className="rs-prose mt-6 max-w-xl text-xl text-[var(--rs-ink-soft)]">
            Contribute what you can, receive voting tokens, and decide together
            how the whole pot is shared across our demonstrator projects. One
            member, many choices — the split follows the community.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <RsButton onClick={onContribute}>
              Contribute <ArrowRight size={14} />
            </RsButton>
            {user ? (
              <a href="#projects">
                <RsButton variant="ghost">Allocate your tokens</RsButton>
              </a>
            ) : (
              <RsButton variant="ghost" onClick={onSignIn}>
                Sign in and get {JOIN_BONUS_RSUT} RSUT
              </RsButton>
            )}
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-[var(--rs-line)] pt-7">
            <div>
              <dt className="rs-eyebrow text-[var(--rs-ink-faint)]">
                Pot this round
              </dt>
              <dd className="rs-heading rs-tabular mt-1.5 text-2xl">
                {formatAud(totalPotAud)}
              </dd>
            </div>
            <div>
              <dt className="rs-eyebrow text-[var(--rs-ink-faint)]">
                Contributors
              </dt>
              <dd className="rs-heading rs-tabular mt-1.5 text-2xl">
                {formatNumber(cycle.contributors)}
              </dd>
            </div>
            <div>
              <dt className="rs-eyebrow text-[var(--rs-ink-faint)]">Matched</dt>
              <dd className="rs-heading rs-tabular mt-1.5 text-2xl">
                1&nbsp;:&nbsp;1
              </dd>
            </div>
          </dl>
        </div>

        {/* Circular photo crop — their signature image treatment. */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-6 -top-6 size-32 rounded-full bg-[var(--rs-aqua)] sm:size-40" />
          <div className="absolute -bottom-8 -right-4 size-24 rounded-full bg-[var(--rs-peach)] sm:size-32" />
          <div className="relative aspect-square overflow-hidden rounded-full border-8 border-[var(--rs-sand)] shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/hero.webp"
              alt="Regen Sydney community gathering in a rope circle at sunset"
              className="size-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
