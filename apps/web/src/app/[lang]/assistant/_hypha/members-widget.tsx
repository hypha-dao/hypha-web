'use client';

import { z } from 'zod';
import type { Person } from '@hypha-platform/core/client';
import type { WidgetDefinition } from '@hypha-platform/epics';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 M7 `members` widget — a thin adapter over the space members roster route
 * (`/api/v1/spaces/<slug>/members`, the same endpoint the classic Members screen
 * uses). v0 renders a compact avatar + name list; the header count is the roster
 * total, not the page size.
 */
const membersParams = z.object({
  spaceSlug: z.string().trim().min(1),
  limit: z.number().int().positive().max(30).optional(),
});

type MembersParams = z.infer<typeof membersParams>;

const PAGE_SIZE = 30;
const DEFAULT_LIMIT = 10;

interface MembersResponse {
  persons?: {
    data?: Person[];
    pagination?: { total?: number };
  };
}

function displayName(person: Person): string {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname?.trim() || person.slug?.trim() || 'Member';
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatJoined(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function MembersWidget({ params }: { params: MembersParams }) {
  const { data, isLoading } = useSpaceJson<MembersResponse>(
    `/api/v1/spaces/${params.spaceSlug}/members?pageSize=${PAGE_SIZE}`,
  );

  const all = Array.isArray(data?.persons?.data) ? data!.persons!.data! : [];
  const total = data?.persons?.pagination?.total ?? all.length;
  const members = all.slice(0, params.limit ?? DEFAULT_LIMIT);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Members</h2>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Loading…' : `${total}`}
        </span>
      </div>

      {!isLoading && members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members to show.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((person) => {
            const label = displayName(person);
            const joined = formatJoined(person.createdAt);
            return (
              <li
                key={person.id}
                className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
              >
                {person.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={person.avatarUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                    {initials(label)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {label}
                </span>
                {joined ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {joined}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && total > members.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          +{total - members.length} more
        </p>
      ) : null}
    </div>
  );
}

export const membersWidget: WidgetDefinition<MembersParams> = {
  id: 'members',
  title: 'Members',
  paramsSchema: membersParams,
  component: MembersWidget,
  describeForModel: () =>
    "members — this space's member roster (people), with the roster total. params: spaceSlug (required), limit? (1-30, default 10).",
};
