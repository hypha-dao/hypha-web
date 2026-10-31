'use client';

import { cn } from '@hypha-platform/ui-utils';

import type { GroupFace } from './member-connections';

/** Overlapping pair of member faces — Messages list and group chat header. */
export function GroupFaces({
  faces,
  size = 'list',
  className,
}: {
  faces: readonly GroupFace[];
  /** `list` matches People Around rows; `header` matches chat panel chrome. */
  size?: 'list' | 'header';
  className?: string;
}) {
  const shown = faces.slice(0, 2);
  if (shown.length === 0) return null;
  // Header fills the 36px chrome slot (same as room toggle / toolbar avatar).
  const box = size === 'header' ? 'h-full w-full' : 'h-10 w-10';
  const face = size === 'header' ? 'size-[20px]' : 'size-[22px]';
  return (
    <span className={cn('relative block shrink-0', box, className)} aria-hidden>
      {shown.map((entry, index) => (
        <span
          key={`${entry.name}-${entry.userId ?? index}`}
          className={cn(
            'absolute block overflow-hidden rounded-full bg-neutral-3 ring-2 ring-background',
            size === 'list' &&
              'group-hover/row:ring-accent-2 group-data-[active=true]/row:ring-accent-2',
            face,
            index === 0 ? 'top-0 left-0' : 'right-0 bottom-0',
          )}
        >
          {entry.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Matrix/Hypha avatars
            <img
              src={entry.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-neutral-11">
              {entry.name.replace(/^@/, '').trim().charAt(0).toUpperCase() ||
                '?'}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
