'use client';

import { z } from 'zod';
import type { Document } from '@hypha-platform/core/client';
import type {
  WidgetComponentProps,
  WidgetDefinition,
} from '@hypha-platform/epics';
import { Badge, Button } from '@hypha-platform/ui';
import { Telescope } from 'lucide-react';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 v0 `agreements` widget — a thin adapter over the space documents REST
 * route (`/documents/all`, the same endpoint `useSpaceDocumentsWithStatuses`
 * uses). v0 renders a compact "newest first" list; it does not cross-reference
 * on-chain proposal status the way the full `DocumentsSections` tab does.
 */
const agreementsParams = z.object({
  spaceSlug: z.string().trim().min(1),
  limit: z.number().int().positive().max(20).optional(),
  label: z.string().trim().min(1).optional(),
});

type AgreementsParams = z.infer<typeof agreementsParams>;

const DEFAULT_LIMIT = 5;

function formatDate(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function AgreementsWidget({
  params,
  onEvent,
}: WidgetComponentProps<AgreementsParams>) {
  const { data, isLoading } = useSpaceJson<Document[]>(
    `/api/v1/spaces/${params.spaceSlug}/documents/all?order=-createdAt`,
  );

  const all = Array.isArray(data) ? data : [];
  const filtered = params.label
    ? all.filter(
        (doc) => doc.label?.toLowerCase() === params.label?.toLowerCase(),
      )
    : all;
  const documents = filtered.slice(0, params.limit ?? DEFAULT_LIMIT);

  const emitDrill = (doc: Document) =>
    onEvent?.({
      type: 'drill',
      sourceWidgetId: 'agreements',
      descriptor: {
        itemKind: 'agreement',
        label: doc.title,
        scope: 'item',
        itemSlug: doc.slug ?? String(doc.id),
        itemId: String(doc.id),
      },
    });

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">
          Agreements{params.label ? ` · ${params.label}` : ''}
        </h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${filtered.length}`}
        </span>
      </div>

      {!isLoading && documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agreements to show.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                {doc.label ? (
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {doc.label}
                  </Badge>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {doc.title}
                </span>
                {onEvent ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Dig deeper: ${doc.title}`}
                    title={`Dig deeper: ${doc.title}`}
                    onClick={() => emitDrill(doc)}
                  >
                    <Telescope className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              {doc.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {doc.description}
                </p>
              ) : null}
              {formatDate(doc.createdAt) ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(doc.createdAt)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const agreementsWidget: WidgetDefinition<AgreementsParams> = {
  id: 'agreements',
  title: 'Agreements',
  paramsSchema: agreementsParams,
  component: AgreementsWidget,
  describeForModel: () =>
    "agreements — this space's agreements / proposals (documents), newest first. params: spaceSlug (required), limit? (1-20, default 5), label? (filter by document label, e.g. a proposal type).",
};
