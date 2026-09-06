'use client';

import { z } from 'zod';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import type { Document } from '@hypha-platform/core/client';
import type { WidgetDefinition } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 v0 `space-overview` widget — a thin adapter over `useSpaceBySlug`.
 * Renders the space header + a few headline counts, taking `spaceSlug` as a
 * param rather than route context (spec §5.3 invariant #1).
 */
const spaceOverviewParams = z.object({
  spaceSlug: z.string().trim().min(1),
});

type SpaceOverviewParams = z.infer<typeof spaceOverviewParams>;

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface MembersResponse {
  persons?: { data?: unknown[]; pagination?: { total?: number } };
}

function SpaceOverviewWidget({ params }: { params: SpaceOverviewParams }) {
  const { space, isLoading } = useSpaceBySlug(params.spaceSlug);

  // `/api/v1/spaces/<slug>` (findSpaceBySlug) does not populate memberCount /
  // documentCount — those exist only on the web3 space variant. Pull the counts
  // from the same routes the `members` / `agreements` widgets render so this
  // card agrees with them.
  const { data: membersData } = useSpaceJson<MembersResponse>(
    `/api/v1/spaces/${params.spaceSlug}/members?pageSize=1`,
  );
  const { data: documentsData } = useSpaceJson<Document[]>(
    `/api/v1/spaces/${params.spaceSlug}/documents/all?order=-createdAt`,
  );

  const memberCount =
    membersData?.persons?.pagination?.total ?? space?.memberCount ?? 0;
  const documentCount = Array.isArray(documentsData)
    ? documentsData.length
    : space?.documentCount ?? 0;

  if (isLoading && !space) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!space?.slug) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        Couldn’t find “{params.spaceSlug}”.
      </div>
    );
  }

  const subspaceCount = space.subspaces?.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{space.title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {space.slug}
        </span>
      </div>

      {space.description ? (
        <p className="mb-3 line-clamp-3 text-xs text-muted-foreground">
          {space.description}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2">
        <Stat label="Members" value={memberCount} />
        <Stat label="Agreements" value={documentCount} />
        {subspaceCount > 0 ? (
          <Stat label="Subspaces" value={subspaceCount} />
        ) : null}
      </div>

      {space.categories?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {space.categories.slice(0, 6).map((category) => (
            <Badge
              key={String(category)}
              variant="outline"
              className="capitalize"
            >
              {String(category)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const spaceOverviewWidget: WidgetDefinition<SpaceOverviewParams> = {
  id: 'space-overview',
  title: 'Space overview',
  paramsSchema: spaceOverviewParams,
  component: SpaceOverviewWidget,
  describeForModel: () =>
    'space-overview — the space header: title, description, member count, agreement count, subspaces, categories. params: spaceSlug (required).',
};
