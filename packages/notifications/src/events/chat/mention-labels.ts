import {
  extractMentionUserIdsFromPlainBody,
  replacePlainTextMatrixMxidsWithLabels,
} from '@hypha-platform/core/client';

export { extractMentionUserIdsFromPlainBody };

/**
 * `@Name Surname` — how the chat UI shows a mention. `null` when the person has no name to show, so
 * the caller leaves the raw Matrix ID in place rather than inventing a label.
 */
export function formatMentionLabel(
  name: string | null | undefined,
  surname: string | null | undefined,
): string | null {
  const full = [name, surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return full ? `@${full}` : null;
}

/**
 * The Matrix message `body` carries mentions as raw MXIDs (`@user:homeserver`) — the chat UI renders
 * names from `formatted_body`, which the server-fired path doesn't use. Swap each known MXID for its
 * label; MXIDs with no label (bots, non-Hypha users) are left as they were.
 */
export function applyMentionLabels(
  body: string,
  labelsByMatrixUserId: ReadonlyMap<string, string>,
): string {
  return replacePlainTextMatrixMxidsWithLabels(
    body,
    (matrixUserId) => labelsByMatrixUserId.get(matrixUserId) ?? '',
  );
}
