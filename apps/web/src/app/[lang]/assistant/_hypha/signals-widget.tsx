'use client';

import { z } from 'zod';
import { useFindCoherences } from '@hypha-platform/core/client';
import type { WidgetDefinition } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';

/**
 * #2486 v0 `signals` widget — a thin adapter over the existing coherence data
 * hook (`useFindCoherences` / `CoherenceQuery`, the flagship filter contract).
 *
 * v0 renders a compact read-only list rather than the full `SignalSection`:
 * `SignalSection` / `SignalCard` read the space slug from `useParams().id`
 * (spec §5.3 invariant #1 — a widget must take params, not route context), which
 * is `undefined` on `/[lang]/assistant`. Swapping in the full component behind a
 * route-param bridge is a fidelity upgrade the adapter boundary keeps cheap.
 */
const signalsParams = z.object({
  spaceSlug: z.string().trim().min(1),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  orderBy: z
    .enum(['mostrecent', 'mostmessages', 'mostviews', 'mostupvoted'])
    .optional(),
});

type SignalsParams = z.infer<typeof signalsParams>;

function SignalsWidget({ params }: { params: SignalsParams }) {
  const { coherences, isLoading } = useFindCoherences({
    spaceSlug: params.spaceSlug,
    priority: params.priority,
    orderBy: params.orderBy ?? 'mostrecent',
  });

  const signals = coherences ?? [];

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">
          Signals{params.priority ? ` · ${params.priority}` : ''}
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
                <span className="truncate text-sm font-medium">
                  {signal.title}
                </span>
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
    "signals — this space's signal board (coherence items). params: spaceSlug (required), priority? (critical|high|medium|low), orderBy? (mostrecent|mostmessages|mostviews|mostupvoted).",
};
