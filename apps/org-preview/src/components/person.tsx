'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/primitives';
import { useStore } from '@/lib/store';

const NOT_A_PERSON = new Set([
  'open',
  'nobody yet',
  'a member',
  'the ticket holder',
  'the project DRI',
  'New member',
  'created via the assistant',
  'the org',
  'the Shapers',
  'the new member',
]);

export function isPersonName(name: string): boolean {
  if (!name || NOT_A_PERSON.has(name)) return false;
  if (name === 'You') return true;
  return /^[\p{L}][\p{L} .'-]*$/u.test(name);
}

/** A name that opens that person’s profile. Safe inside clickable cards. */
export function PersonLink({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const s = useStore();
  if (!isPersonName(name)) return <>{name}</>;
  return (
    <span
      role="link"
      tabIndex={0}
      className={cn(
        'cursor-pointer underline-offset-2 hover:underline',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        s.openProfile(name);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          s.openProfile(name);
        }
      }}
    >
      {name}
    </span>
  );
}

/** Turn names in a short phrase into profile links. Leaves the rest alone. */
export function linkNames(text: string): ReactNode {
  const parts = text.split(/(\b[\p{L}][\p{L}'-]+(?:\s[\p{L}][\p{L}'-]+)?\b)/u);
  return parts.map((part, i) =>
    isPersonName(part) ? <PersonLink key={`${part}-${i}`} name={part} /> : part,
  );
}
