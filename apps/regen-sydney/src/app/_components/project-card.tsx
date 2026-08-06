'use client';

import { Minus, Play, Plus, Users } from 'lucide-react';

import { cn } from '../_lib/cn';

import {
  formatAud,
  formatNumber,
  useCampaign,
  type TallyRow,
} from '../_lib/campaign-store';
import { Pill, RsButton, ShareBar } from './ui';

const STEP = 5;

export function ProjectCard({
  row,
  onSignIn,
}: {
  row: TallyRow;
  onSignIn: () => void;
}) {
  const { project, votes, yourVotes, share, projectedAud } = row;
  const { user, remaining, adjustAllocation, setAllocation, balance } =
    useCampaign();

  const yourShare = votes > 0 ? (yourVotes / votes) * share : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-[var(--rs-white)] shadow-[0_1px_0_var(--rs-line)] transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--rs-aqua-soft)]">
        {project.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.image}
            alt=""
            className="size-full object-cover transition-transform duration-500 hover:scale-105"
          />
        ) : null}
        <div className="absolute left-4 top-4">
          <Pill tone="aqua">{project.program}</Pill>
        </div>
        {yourVotes > 0 ? (
          <div className="absolute right-4 top-4">
            <Pill tone="peach">{formatNumber(yourVotes)} yours</Pill>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="rs-heading text-xl leading-snug">{project.title}</h3>

        <p className="rs-prose mt-3 flex-1 text-[0.95rem] text-[var(--rs-ink-soft)]">
          {project.summary}
        </p>

        <div className="rs-ui mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--rs-ink-faint)]">
          {project.team ? (
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} /> {project.team}
            </span>
          ) : null}
          {project.videoUrl ? (
            <a
              href={project.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="rs-focus inline-flex items-center gap-1.5 rounded text-[var(--rs-clay)] hover:underline"
            >
              <Play size={13} /> Watch the video
            </a>
          ) : null}
        </div>

        <div className="mt-6 border-t border-[var(--rs-line)] pt-5">
          <div className="rs-ui mb-2 flex items-baseline justify-between text-xs">
            <span className="rs-tabular text-[var(--rs-ink-soft)]">
              {formatNumber(votes)} votes
            </span>
            <span className="rs-heading rs-tabular text-base">
              {(share * 100).toFixed(1)}% &middot; {formatAud(projectedAud)}
            </span>
          </div>
          <ShareBar share={share} yourShare={yourShare} />
        </div>

        {user ? (
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustAllocation(project.id, -STEP)}
              disabled={yourVotes === 0}
              aria-label={`Remove ${STEP} votes from ${project.title}`}
              className="rs-focus flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--rs-line)] transition-colors hover:border-[var(--rs-ink)] disabled:opacity-30"
            >
              <Minus size={15} />
            </button>

            <input
              type="range"
              min={0}
              max={balance}
              step={1}
              value={yourVotes}
              onChange={(event) =>
                setAllocation(project.id, Number(event.target.value))
              }
              aria-label={`Votes for ${project.title}`}
              className="rs-focus h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--rs-cream-deep)] accent-[var(--rs-clay)]"
            />

            <button
              type="button"
              onClick={() => adjustAllocation(project.id, STEP)}
              disabled={remaining === 0}
              aria-label={`Add ${STEP} votes to ${project.title}`}
              className={cn(
                'rs-focus flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-30',
                remaining > 0
                  ? 'border-[var(--rs-clay)] bg-[var(--rs-peach)]'
                  : 'border-[var(--rs-line)]',
              )}
            >
              <Plus size={15} />
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <RsButton
              variant="quiet"
              size="sm"
              onClick={onSignIn}
              className="w-full"
            >
              Sign in to vote
            </RsButton>
          </div>
        )}
      </div>
    </article>
  );
}
