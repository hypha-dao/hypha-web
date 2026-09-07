'use client';

import { z } from 'zod';
import { useFindCoherences } from '@hypha-platform/core/client';
import type {
  WidgetComponentProps,
  WidgetDefinition,
} from '@hypha-platform/epics';
import { Badge, Button } from '@hypha-platform/ui';
import { Telescope } from 'lucide-react';

/**
 * #2486 v0 `signals` widget — a thin adapter over the existing coherence data
 * hook (`useFindCoherences` / `CoherenceQuery`, the flagship filter contract).
 *
 * v0 renders a compact read-only list rather than the full `SignalSection`:
 * `SignalSection` / `SignalCard` read the space slug from `useParams().id`
 * (spec §5.3 invariant #1 — a widget must take params, not route context), which
 * is `undefined` on `/[lang]/coherent-intelligent-system`. Swapping in the full component behind a
 * route-param bridge is a fidelity upgrade the adapter boundary keeps cheap.
 */
const signalsParams = z.object({
  spaceSlug: z.string().trim().min(1),
  // `'all'` / omitted = no priority filter. Accepting `'all'` (rather than
  // rejecting it) keeps a stray model param from dropping the widget → retry
  // loop (#2486 M8 follow-up).
  priority: z.enum(['all', 'critical', 'high', 'medium', 'low']).optional(),
  orderBy: z
    .enum(['mostrecent', 'mostmessages', 'mostviews', 'mostupvoted'])
    .optional(),
});

type SignalsParams = z.infer<typeof signalsParams>;

function SignalsWidget({
  params,
  onEvent,
}: WidgetComponentProps<SignalsParams>) {
  const priorityFilter =
    params.priority && params.priority !== 'all' ? params.priority : undefined;
  const { coherences, isLoading } = useFindCoherences({
    spaceSlug: params.spaceSlug,
    priority: priorityFilter,
    orderBy: params.orderBy ?? 'mostrecent',
  });

  const signals = coherences ?? [];

  const emitDrill = (signal: (typeof signals)[number]) =>
    onEvent?.({
      type: 'drill',
      sourceWidgetId: 'signals',
      descriptor: {
        itemKind: 'signal',
        label: signal.title,
        scope: 'item',
        itemSlug: signal.slug ?? String(signal.id),
        itemId: String(signal.id),
      },
    });

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">
          Signals
          {priorityFilter ? ` · ${priorityFilter}` : ''}
        </h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${signals.length}`}
        </span>
      </div>

      {!isLoading && signals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signals to show.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {signals.map((signal) => (
            <li
              key={signal.id}
              className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 capitalize">
                  {signal.priority}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {signal.title}
                </span>
                {onEvent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Dig deeper: ${signal.title}`}
                    title={`Dig deeper: ${signal.title}`}
                    onClick={() => emitDrill(signal)}
                  >
                    <Telescope className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              {signal.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {signal.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="capitalize">{signal.type}</span>
                {signal.tags?.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded bg-muted px-1.5 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const signalsWidget: WidgetDefinition<SignalsParams> = {
  id: 'signals',
  title: 'Signals',
  paramsSchema: signalsParams,
  component: SignalsWidget,
  describeForModel: () =>
    "signals — this space's signal board (coherence items). params: spaceSlug (required), priority? (all|critical|high|medium|low — 'all' or omitted = no filter), orderBy? (mostrecent|mostmessages|mostviews|mostupvoted).",
};
