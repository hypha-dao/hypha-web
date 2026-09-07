'use client';

import * as React from 'react';
import { z } from 'zod';
import {
  ArrowRight,
  FileText,
  HeartHandshake,
  Lightbulb,
  Radar,
  RefreshCw,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useFindCoherences } from '@hypha-platform/core/client';
import type { Document } from '@hypha-platform/core/client';
import type {
  WidgetComponentProps,
  WidgetDefinition,
} from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 M11 — the Coherence Overview. The framework-first entry point shown on
 * a fresh load / new session (seeded via `Greeting.canvas`): the coherence loop
 * rendered as the live cycle, with the **alignment loop** (signals +
 * sensemaking) foregrounded. Every stage is a "dig deeper" affordance — a click
 * fires a normal turn and the IO digs into that aspect.
 *
 * Not a dashboard: the numbers are a pulse, not the point. Signals / proposals
 * counts are real where a space is scoped; commitments / outcomes are mocked
 * pending a domain model.
 */
const coherenceOverviewParams = z.object({
  spaceSlug: z.string().trim().min(1).optional(),
});

type CoherenceOverviewParams = z.infer<typeof coherenceOverviewParams>;

type Stage = {
  key: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  /** Domain concept the drill-in turn is about. */
  itemKind: string;
};

const STAGES: Stage[] = [
  {
    key: 'signals',
    name: 'Signals',
    blurb: 'What the collective is sensing',
    icon: Radar,
    itemKind: 'signals',
  },
  {
    key: 'sensemaking',
    name: 'Sensemaking',
    blurb: 'Making meaning of it, together',
    icon: Lightbulb,
    itemKind: 'sensemaking',
  },
  {
    key: 'commitments',
    name: 'Commitments',
    blurb: 'What we agree to hold',
    icon: HeartHandshake,
    itemKind: 'commitments',
  },
  {
    key: 'proposals',
    name: 'Proposals',
    blurb: 'Shaping the response',
    icon: FileText,
    itemKind: 'agreements',
  },
  {
    key: 'outcomes',
    name: 'Outcomes',
    blurb: 'What actually changed',
    icon: Target,
    itemKind: 'outcomes',
  },
];

/** Stage the alignment loop most needs a person in — hardcoded for v0. */
const NEEDS_YOU = 'sensemaking';

function CoherenceOverviewWidget({
  params,
  onEvent,
}: WidgetComponentProps<CoherenceOverviewParams>) {
  const slug = params.spaceSlug;

  const { coherences } = useFindCoherences({ spaceSlug: slug });
  const { data: docs } = useSpaceJson<Document[]>(
    slug ? `/api/v1/spaces/${slug}/documents/all?order=-createdAt` : null,
  );

  const counts: Record<string, string> = {
    signals: coherences ? `${coherences.length}` : '—',
    sensemaking: 'now',
    commitments: '4',
    proposals: Array.isArray(docs) ? `${docs.length}` : '—',
    outcomes: '2',
  };

  const dig = (stage: Stage) =>
    onEvent?.({
      type: 'drill',
      sourceWidgetId: 'coherence-overview',
      descriptor: {
        itemKind: stage.itemKind,
        label: stage.name,
        scope: 'widget',
      },
    });

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-2 leading-snug text-muted-foreground">
        Here&rsquo;s where{' '}
        <span className="font-medium text-foreground">
          {slug ?? 'your organization'}
        </span>{' '}
        is in its coherence cycle. The alignment loop needs your{' '}
        <span className="font-medium text-accent-11">sensemaking</span> — start
        anywhere.
      </p>

      <div className="flex flex-wrap items-stretch gap-2">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const needsYou = stage.key === NEEDS_YOU;
          return (
            <React.Fragment key={stage.key}>
              <button
                type="button"
                onClick={() => dig(stage)}
                aria-label={`Dig deeper: ${stage.name}`}
                className={cn(
                  'group flex min-w-[8.5rem] flex-1 basis-[8.5rem] flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors',
                  needsYou
                    ? 'border-accent-8 bg-accent-3 hover:bg-accent-4'
                    : 'border-border bg-background hover:border-accent-7 hover:bg-background-3',
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon
                    className={cn(
                      'size-4',
                      needsYou ? 'text-accent-11' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-1 tabular-nums',
                      needsYou
                        ? 'font-medium text-accent-11'
                        : 'text-muted-foreground',
                    )}
                  >
                    {counts[stage.key]}
                  </span>
                </div>
                <span className="text-2 font-medium leading-tight text-foreground [font-family:var(--font-family-heading)]">
                  {stage.name}
                </span>
                <span className="text-1 leading-tight text-muted-foreground">
                  {stage.blurb}
                </span>
                {needsYou && (
                  <span className="mt-0.5 text-1 font-medium text-accent-11">
                    Needs you now →
                  </span>
                )}
              </button>
              {i < STAGES.length - 1 && (
                <div className="flex shrink-0 items-center self-center text-muted-foreground">
                  <ArrowRight className="size-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 text-1 text-muted-foreground">
        <RefreshCw className="size-3.5" />
        Outcomes feed back into signals — revisit alignment, keep connectivity.
      </div>
    </div>
  );
}

export const coherenceOverviewWidget: WidgetDefinition<CoherenceOverviewParams> =
  {
    id: 'coherence-overview',
    title: 'Coherence overview',
    paramsSchema: coherenceOverviewParams,
    component: CoherenceOverviewWidget,
    describeForModel: () =>
      "coherence-overview — the organization's coherence loop as a live cycle (signals → sensemaking → commitments → proposals → outcomes), each stage a starting point. Shown by default on a fresh session; place it when the member asks for an overview of where the space stands or how coherence is going. params: spaceSlug (optional).",
  };
