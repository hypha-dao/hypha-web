'use client';

import { formatAud, formatNumber, useCampaign } from '../_lib/campaign-store';
import { SectionHeading, ShareBar } from './ui';

export function TallySection() {
  const { tally, totalPotAud, user } = useCampaign();

  return (
    <section id="tally" className="scroll-mt-24 bg-[var(--rs-sand)] px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <SectionHeading
          eyebrow="Updating live"
          title="Projected allocation"
          lede={`If voting closed right now, this is how the ${formatAud(
            totalPotAud,
          )} pot would be shared.`}
        />

        <div className="mt-12 space-y-6">
          {tally.map((row) => {
            const yourShare =
              row.votes > 0 ? (row.yourVotes / row.votes) * row.share : 0;
            return (
              <div key={row.project.id}>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <span className="rs-heading text-sm sm:text-base">
                    {row.project.title}
                  </span>
                  <span className="rs-heading rs-tabular shrink-0 text-base sm:text-lg">
                    {formatAud(row.projectedAud)}
                  </span>
                </div>
                <ShareBar share={row.share} yourShare={yourShare} />
                <div className="rs-ui mt-1.5 flex justify-between text-xs text-[var(--rs-ink-faint)]">
                  <span className="rs-tabular">
                    {formatNumber(row.votes)} votes
                    {row.yourVotes > 0
                      ? ` · ${formatNumber(row.yourVotes)} from you`
                      : ''}
                  </span>
                  <span className="rs-tabular">
                    {(row.share * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {user ? (
          <div className="rs-ui mt-10 flex items-center gap-6 border-t border-[var(--rs-line)] pt-6 text-xs text-[var(--rs-ink-faint)]">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--rs-aqua)]" />
              Other members
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--rs-clay)]" />
              Your votes
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
