'use client';

import { ArrowRight } from 'lucide-react';

import { formatAud, useCampaign } from '../_lib/campaign-store';
import { RsButton } from './ui';

export function ContributeBand({ onContribute }: { onContribute: () => void }) {
  const { cycle } = useCampaign();

  return (
    <section className="bg-[var(--rs-peach)] px-5 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="rs-eyebrow text-[var(--rs-clay)]">Grow the pot</p>
          <h2 className="rs-heading mt-3 text-3xl sm:text-4xl">
            Your dollar counts twice
          </h2>
          <p className="rs-prose mt-5 max-w-xl text-lg">
            Philanthropic partners match community contributions 1:1, so
            everything you put in doubles before it reaches the projects. So far
            this round the community has raised{' '}
            {formatAud(cycle.communityPotAud)} from {cycle.contributors}{' '}
            contributors.
          </p>
          <div className="mt-8">
            <RsButton variant="secondary" onClick={onContribute}>
              Contribute now <ArrowRight size={14} />
            </RsButton>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xs">
          <div className="aspect-square overflow-hidden rounded-full border-8 border-[var(--rs-cream)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/community.webp"
              alt="Members of the Regen Sydney community gathered in a spiral"
              className="size-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
