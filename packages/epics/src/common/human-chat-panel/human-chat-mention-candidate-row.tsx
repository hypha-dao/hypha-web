'use client';

import { useMemo } from 'react';
import {
  useUserPrivyIdByMatrixId,
  usePersonBySub,
} from '@hypha-platform/core/client';

import { PersonAvatar } from '../../people/components/person-avatar';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from '../../spaces/components/compact-space-banner';
import { cn } from '@hypha-platform/ui-utils';

function formatHyphaPersonName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  return p.nickname?.trim() ?? '';
}

export type MentionCandidateRowProps = {
  matrixUserId: string;
  matrixFallbackLabel: string;
  matrixFallbackAvatarUrl?: string;
  /** When set (space roster row), fetch Person directly — skips Matrix→Privy link query. */
  privySub?: string;
  isActive: boolean;
  onPick: () => void;
};

/**
 * Single `@` picker row: prefer Hypha profile name (same as Members tab) when we can resolve
 * `matrix_user_links` → Privy sub → Person.
 */
export function HumanChatMentionCandidateRow({
  matrixUserId,
  matrixFallbackLabel,
  matrixFallbackAvatarUrl,
  privySub,
  isActive,
  onPick,
}: MentionCandidateRowProps) {
  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: privySub ? undefined : matrixUserId,
    });
  const resolvedSub = privySub ?? linkedSub;
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: resolvedSub,
  });

  const resolvedName = useMemo(() => {
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    return fromPerson || matrixFallbackLabel;
  }, [person, matrixFallbackLabel]);

  const avatarSrc =
    person?.avatarUrl?.trim() || matrixFallbackAvatarUrl || undefined;
  const busy =
    (!privySub && loadingLink) || (Boolean(resolvedSub) && loadingPerson);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      aria-busy={busy || undefined}
      title={resolvedName}
      disabled={!privySub && loadingLink}
      className={cn(
        'flex w-full min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm',
        busy && 'opacity-70',
        isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/80',
      )}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={onPick}
    >
      <PersonAvatar
        avatarSrc={avatarSrc}
        userName={resolvedName}
        size="sm"
        className={cn('shrink-0', APP_CHROME_SUBTLE_SQUARE_RADIUS)}
        isLoading={busy}
      />
      <span className="min-w-0 flex-1 truncate font-medium leading-snug">
        {resolvedName}
      </span>
    </button>
  );
}
