'use client';

import { PersonAvatar } from '../../people/components/person-avatar';
import { APP_CHROME_SUBTLE_SQUARE_RADIUS } from '../../spaces/components/compact-space-banner';
import { cn } from '@hypha-platform/ui-utils';

import { useResolvedMentionCandidateLabel } from './use-resolved-mention-candidate-label';

export type MentionCandidateRowProps = {
  matrixUserId: string;
  matrixFallbackLabel: string;
  matrixFallbackAvatarUrl?: string;
  /** When set (space roster row), fetch Person directly — skips Matrix→Privy link query. */
  privySub?: string;
  isActive: boolean;
  /** Legacy: no resolved Hypha name. Prefer {@link onPickResolved}. */
  onPick?: () => void;
  /**
   * Called with the same display string shown in the row (Hypha Person name when resolved).
   * Use this for the composer token so it matches the dropdown.
   */
  onPickResolved?: (resolvedDisplayForComposer: string) => void;
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
  onPickResolved,
}: MentionCandidateRowProps) {
  const {
    resolvedLabel: resolvedName,
    busy,
    avatarUrl,
    pickDisabled,
  } = useResolvedMentionCandidateLabel({
    userId: matrixUserId,
    displayLabel: matrixFallbackLabel,
    privySub,
  });

  const avatarSrc = avatarUrl?.trim() || matrixFallbackAvatarUrl || undefined;

  const handleClick = () => {
    if (onPickResolved) {
      onPickResolved(resolvedName);
    } else {
      onPick?.();
    }
  };

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      aria-busy={busy || undefined}
      title={resolvedName}
      disabled={pickDisabled}
      className={cn(
        'flex w-full min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm',
        busy && 'opacity-70',
        isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/80',
      )}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={handleClick}
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
