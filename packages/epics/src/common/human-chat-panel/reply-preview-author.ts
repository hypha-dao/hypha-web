import {
  isHyphaBotMatrixIdentity,
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
} from './matrix-room-member-display';

export type ReplyPreviewAuthorKind = 'you' | 'agent' | 'person';

export type ReplyPreviewAuthorLookup = {
  kind: ReplyPreviewAuthorKind;
  matrixUserId: string;
  canonicalSub: string | null;
  /** When true, `useUserPrivyIdByMatrixId` should receive the Matrix id. */
  needsLinkLookup: boolean;
  /** When true, `usePersonBySub` should receive the resolved Privy sub. */
  needsPersonLookup: boolean;
};

/**
 * Decide how the composer reply chip should label the quoted author.
 * Callers must run every React hook on every render; use the flags here
 * to no-op lookups instead of returning before hooks.
 */
export function resolveReplyPreviewAuthorLookup(input: {
  isYou?: boolean;
  sourceUserId?: string;
  authorLabel: string;
}): ReplyPreviewAuthorLookup {
  const matrixUserId = input.sourceUserId?.trim() ?? '';
  if (input.isYou) {
    return {
      kind: 'you',
      matrixUserId,
      canonicalSub: null,
      needsLinkLookup: false,
      needsPersonLookup: false,
    };
  }
  if (isHyphaBotMatrixIdentity(matrixUserId, input.authorLabel)) {
    return {
      kind: 'agent',
      matrixUserId,
      canonicalSub: null,
      needsLinkLookup: false,
      needsPersonLookup: false,
    };
  }
  const canonicalSub = matrixUserId
    ? matrixUserIdToCanonicalPrivySub(matrixUserId)
    : null;
  const authorLooksTechnical = looksLikeTechnicalMatrixDisplayName(
    input.authorLabel,
    matrixUserId,
  );
  const hasFriendlyAuthorLabel =
    Boolean(input.authorLabel.trim()) &&
    input.authorLabel.trim() !== matrixUserId &&
    !authorLooksTechnical;
  const needsLinkLookup =
    Boolean(matrixUserId) && !canonicalSub && !hasFriendlyAuthorLabel;
  const needsPersonLookup =
    !hasFriendlyAuthorLabel && (Boolean(canonicalSub) || needsLinkLookup);
  return {
    kind: 'person',
    matrixUserId,
    canonicalSub,
    needsLinkLookup,
    needsPersonLookup,
  };
}
