'use client';

import { z } from 'zod';
import { useFindCoherences } from '@hypha-platform/core/client';
import type { WidgetDefinition } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';

/**
 * #2486 M9 — `single-signal` widget. The focused view the model lands on when a
 * member "digs deeper" into one signal. v0 shows that signal's own detail,
 * self-fetched: there is no single-signal GET route, so it filters the same
 * `useFindCoherences` list the `signals` widget uses (SWR-deduped — no extra
 * request). Room to grow later into linked members / chats / related signals.
 */
const singleSignalParams = z.object({
  spaceSlug: z.string().trim().min(1),
  /** The signal's `slug`; falls back to matching its numeric id as a string. */
  signalSlug: z.string().trim().min(1),
});

type SingleSignalParams = z.infer<typeof singleSignalParams>;

function formatDate(value: Date | string | undefined | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

function SingleSignalWidget({ params }: { params: SingleSignalParams }) {
  const { coherences, isLoading } = useFindCoherences({
    spaceSlug: params.spaceSlug,
  });

  const signal = (coherences ?? []).find(
    (s) => s.slug === params.signalSlug || String(s.id) === params.signalSlug,
  );

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {isLoading && !signal ? (
        <p className="text-sm text-muted-foreground">Loading signal…</p>
      ) : !signal ? (
        <p className="text-sm text-muted-foreground">
          That signal is no longer in this space.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="shrink-0 capitalize">
              {signal.priority}
            </Badge>
            <Badge variant="outline" className="shrink-0 capitalize">
              {signal.type}
            </Badge>
            {signal.progressStatus ? (
              <Badge variant="outline" className="shrink-0 capitalize">
                {signal.progressStatus}
              </Badge>
            ) : null}
          </div>

          <h2 className="text-base font-semibold leading-snug">
            {signal.title}
          </h2>

          {signal.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {signal.description}
            </p>
          ) : null}

          {signal.tags && signal.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {signal.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {typeof signal.messages === 'number' ? (
              <div>
                <dt className="inline font-medium">Messages: </dt>
                <dd className="inline">{signal.messages}</dd>
              </div>
            ) : null}
            {typeof signal.views === 'number' ? (
              <div>
                <dt className="inline font-medium">Views: </dt>
                <dd className="inline">{signal.views}</dd>
              </div>
            ) : null}
            {signal.upvotes &&
            typeof signal.upvotes.upvoteCount === 'number' ? (
              <div>
                <dt className="inline font-medium">Upvotes: </dt>
                <dd className="inline">{signal.upvotes.upvoteCount}</dd>
              </div>
            ) : null}
            {formatDate(signal.dueAt) ? (
              <div>
                <dt className="inline font-medium">Due: </dt>
                <dd className="inline">{formatDate(signal.dueAt)}</dd>
              </div>
            ) : null}
            {formatDate(signal.createdAt) ? (
              <div>
                <dt className="inline font-medium">Created: </dt>
                <dd className="inline">{formatDate(signal.createdAt)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </div>
  );
}

export const singleSignalWidget: WidgetDefinition<SingleSignalParams> = {
  id: 'single-signal',
  title: 'Signal',
  paramsSchema: singleSignalParams,
  component: SingleSignalWidget,
  describeForModel: () =>
    "single-signal — one signal in focus (its priority, type, full description, tags, activity, due date). Use it when the member digs into a specific signal. params: spaceSlug (required), signalSlug (required — the signal's slug).",
};
