'use client';

import { z } from 'zod';
import type { Document } from '@hypha-platform/core/client';
import type { WidgetDefinition } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 M9 — `single-agreement` widget. The focused view the model lands on when
 * a member "digs deeper" into one agreement (document / proposal). v0 shows that
 * document's own detail, self-fetched: there is no single-document GET route, so
 * it filters the same `/documents/all` list the `agreements` widget uses
 * (SWR-deduped). Room to grow later into parties / linked chats / vote status.
 */
const singleAgreementParams = z.object({
  spaceSlug: z.string().trim().min(1),
  /** The document's `slug`; falls back to matching its numeric id as a string. */
  agreementSlug: z.string().trim().min(1),
});

type SingleAgreementParams = z.infer<typeof singleAgreementParams>;

function formatDate(value: Date | string | undefined): string {
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

function SingleAgreementWidget({ params }: { params: SingleAgreementParams }) {
  const { data, isLoading } = useSpaceJson<Document[]>(
    `/api/v1/spaces/${params.spaceSlug}/documents/all?order=-createdAt`,
  );

  const doc = (Array.isArray(data) ? data : []).find(
    (d) =>
      d.slug === params.agreementSlug || String(d.id) === params.agreementSlug,
  );

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {isLoading && !doc ? (
        <p className="text-sm text-muted-foreground">Loading agreement…</p>
      ) : !doc ? (
        <p className="text-sm text-muted-foreground">
          That agreement is no longer in this space.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {doc.label ? (
              <Badge variant="outline" className="shrink-0 capitalize">
                {doc.label}
              </Badge>
            ) : null}
            {doc.state ? (
              <Badge variant="outline" className="shrink-0 capitalize">
                {String(doc.state)}
              </Badge>
            ) : null}
            {doc.status ? (
              <Badge variant="outline" className="shrink-0 capitalize">
                {String(doc.status)}
              </Badge>
            ) : null}
          </div>

          <h2 className="text-base font-semibold leading-snug">{doc.title}</h2>

          {doc.description ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {doc.description}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {formatDate(doc.createdAt) ? (
              <div>
                <dt className="inline font-medium">Created: </dt>
                <dd className="inline">{formatDate(doc.createdAt)}</dd>
              </div>
            ) : null}
            {formatDate(doc.updatedAt) ? (
              <div>
                <dt className="inline font-medium">Updated: </dt>
                <dd className="inline">{formatDate(doc.updatedAt)}</dd>
              </div>
            ) : null}
            {typeof doc.web3ProposalId === 'number' ? (
              <div>
                <dt className="inline font-medium">On-chain proposal: </dt>
                <dd className="inline">#{doc.web3ProposalId}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </div>
  );
}

export const singleAgreementWidget: WidgetDefinition<SingleAgreementParams> = {
  id: 'single-agreement',
  title: 'Agreement',
  paramsSchema: singleAgreementParams,
  component: SingleAgreementWidget,
  describeForModel: () =>
    "single-agreement — one agreement / proposal (document) in focus (its label, state, status, full description, dates, on-chain proposal id). Use it when the member digs into a specific agreement. params: spaceSlug (required), agreementSlug (required — the document's slug).",
};
