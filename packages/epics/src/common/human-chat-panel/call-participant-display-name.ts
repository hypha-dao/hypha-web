import {
  looksLikeTechnicalMatrixDisplayName,
  pickUserVisibleMemberLabel,
} from './matrix-room-member-display';

/** WCUX-AUDIO-TILE-1: profile resolution timeout before Matrix fallback. */
export const CALL_PARTICIPANT_PROFILE_TIMEOUT_MS = 4000;

export function matrixUserLocalpartFallback(
  userId: string | undefined,
): string {
  if (!userId?.trim()) return '';
  const local = userId.trim().replace(/^@/, '').split(':')[0];
  return local?.trim() ?? userId.trim();
}

export type CallParticipantNameSkeletonArgs = {
  isPip: boolean;
  isShare: boolean;
  /** Camera-off / audio-only tile (`!showVideo && !isShare`). */
  isAudioOnlyTile: boolean;
  needsProfile: boolean;
  loadingLink: boolean;
  loadingPerson: boolean;
  linkedSub: string | null | undefined;
  profileTimedOut: boolean;
};

/** WCUX-AUDIO-TILE-2: audio-only tiles never skeleton-only without text. */
export function shouldShowCallParticipantNameSkeleton(
  args: CallParticipantNameSkeletonArgs,
): boolean {
  if (args.isPip || args.isShare || args.isAudioOnlyTile) {
    return false;
  }
  if (args.profileTimedOut) {
    return false;
  }
  return (
    args.needsProfile &&
    (args.loadingLink || (Boolean(args.linkedSub) && args.loadingPerson))
  );
}

export type ResolveCallParticipantDisplayTextArgs = {
  isPip: boolean;
  isLocalFeed: boolean;
  currentUserId: string | null;
  syncLabel: string;
  personName: string;
  matrixUserId: string | undefined;
  matrixMemberLabel: string;
  fallback: string;
};

/** WCUX-AUDIO-TILE-1: never return blank for non-PiP tiles. */
export function resolveCallParticipantDisplayText(
  args: ResolveCallParticipantDisplayTextArgs,
): string {
  if (args.isPip) return '';
  if (args.isLocalFeed && args.currentUserId) {
    return args.syncLabel.trim() || args.fallback.trim();
  }
  if (args.personName.trim()) return args.personName.trim();
  const matrixUserId = args.matrixUserId?.trim() ?? '';
  const visible = pickUserVisibleMemberLabel(
    matrixUserId,
    args.syncLabel,
    args.matrixMemberLabel,
    args.fallback,
  );
  if (visible) return visible;
  const localpart = matrixUserLocalpartFallback(args.matrixUserId);
  if (
    localpart &&
    !looksLikeTechnicalMatrixDisplayName(localpart, matrixUserId)
  ) {
    return localpart;
  }
  return args.fallback.trim();
}
