import {
  looksLikeTechnicalMatrixDisplayName,
  pickUserVisibleMemberLabel,
} from './matrix-room-member-display';

/** A quick tab switch must not repaint every sender as a loading mask. */
export const MEMBER_LABEL_IDLE_REFRESH_MS = 60_000;

export function shouldRefreshMemberLabelsAfterIdle(hiddenMs: number): boolean {
  return hiddenMs >= MEMBER_LABEL_IDLE_REFRESH_MS;
}

/**
 * Keep a name the reader already saw. An idle refresh often resolves to a
 * bridged Matrix id for a moment; swapping that in paints the name mask
 * until the page is reloaded.
 */
export function keepVisibleMemberLabel(
  matrixUserId: string,
  resolved: string | null | undefined,
  current: string | null | undefined,
  placeholder?: string | null,
): string | undefined {
  const placeholderText = placeholder?.trim();
  const withoutPlaceholder = (value: string | null | undefined) => {
    const label = value?.trim();
    if (!label || (placeholderText && label === placeholderText)) return null;
    return label;
  };
  const visible = pickUserVisibleMemberLabel(
    matrixUserId,
    withoutPlaceholder(resolved),
    withoutPlaceholder(current),
  );
  if (visible) return visible;
  const kept = withoutPlaceholder(current);
  if (kept && !looksLikeTechnicalMatrixDisplayName(kept, matrixUserId)) {
    return kept;
  }
  return withoutPlaceholder(resolved) || undefined;
}
