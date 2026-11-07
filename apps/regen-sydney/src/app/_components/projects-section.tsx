'use client';

import { useState } from 'react';

import { cn } from '../_lib/cn';

import {
  GROUP_LABELS,
  useCampaign,
  type ProjectGroup,
} from '../_lib/campaign-store';
import { ProjectCard } from './project-card';
import { SectionHeading } from './ui';

type Filter = 'all' | ProjectGroup;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'initiative', label: GROUP_LABELS.initiative },
  { id: 'program', label: GROUP_LABELS.program },
  { id: 'enabling', label: GROUP_LABELS.enabling },
];

export function ProjectsSection({ onSignIn }: { onSignIn: () => void }) {
  const { tally } = useCampaign();
  const [filter, setFilter] = useState<Filter>('all');

  const rows =
    filter === 'all'
      ? tally
      : tally.filter((row) => row.project.group === filter);

  return (
    <section
      id="projects"
      className="scroll-mt-24 bg-[var(--rs-sand)] px-5 py-20"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="This round's ballot"
            title="Where should the pot go?"
            lede="Spread your tokens across as many projects as you like. You can change your mind any time before voting closes."
          />

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={cn(
                  'rs-eyebrow rs-focus rounded-full border px-4 py-2 transition-colors',
                  filter === item.id
                    ? 'border-[var(--rs-ink)] bg-[var(--rs-ink)] text-[var(--rs-white)]'
                    : 'border-[var(--rs-line)] text-[var(--rs-ink-soft)] hover:border-[var(--rs-ink)]',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <ProjectCard key={row.project.id} row={row} onSignIn={onSignIn} />
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="rs-prose mt-12 text-center text-[var(--rs-ink-faint)]">
            No projects in this group yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
