import { extractMentionUserIdsFromPlainBody } from '@hypha-platform/core/client';

/** Zero-width space — keeps `@` + display name visually distinct from a raw MXID in the composer. */
export const MENTION_DISPLAY_ZWSP = '\u200B';

/**
 * Escape a Hypha/Matrix display label so it cannot break mention token parsing
 * (embedded `@` would fragment MXID regexes).
 */
export function sanitizeMentionDisplayLabel(label: string): string {
  return label.replace(/@/g, '').trim();
}

/**
 * Token inserted into the composer after picking a mention: `@` + ZWSP + display name + trailing space.
 * Matrix wire format uses raw `@mxid`; {@link replaceDisplayNameMentionsWithMxids} runs before send.
 */
export function formatComposerMentionToken(displayLabel: string): string {
  const safe = sanitizeMentionDisplayLabel(displayLabel);
  return `@${MENTION_DISPLAY_ZWSP}${safe} `;
}

/**
 * Replace `@` + ZWSP + known display labels with Matrix user IDs for `m.room.message` body.
 * Longest label first so "John Smith" wins over "John".
 */
export function replaceDisplayNameMentionsWithMxids(
  plain: string,
  labelToUserId: ReadonlyMap<string, string>,
): string {
  const labels = [...labelToUserId.keys()].sort((a, b) => b.length - a.length);
  let out = '';
  let i = 0;
  while (i < plain.length) {
    const z = plain.indexOf(MENTION_DISPLAY_ZWSP, i);
    if (z === -1) {
      out += plain.slice(i);
      break;
    }
    if (z === 0 || plain[z - 1] !== '@') {
      out += plain.slice(i, z + 1);
      i = z + 1;
      continue;
    }

    const after = plain.slice(z + 1);
    let matchedLabel: string | undefined;
    for (const label of labels) {
      if (!after.startsWith(label)) continue;
      const next = after[label.length];
      if (next !== undefined && !/^[\s.,!?;:\n]/.test(next)) continue;
      matchedLabel = label;
      break;
    }

    if (matchedLabel) {
      const uid = labelToUserId.get(matchedLabel);
      if (uid) {
        out += plain.slice(i, z - 1);
        out += uid;
        i = z + 1 + matchedLabel.length;
        continue;
      }
    }

    out += plain.slice(i, z + 1);
    i = z + 1;
  }
  return out;
}

/**
 * Matrix wire text + MSC3952 user_ids for send. The composer may use
 * display-name tokens; this converts them to `@mxid` and collects mention ids.
 */
export function wireComposerPlainForMatrixSend(
  composerPlain: string,
  sanitizedLabelToUserId: ReadonlyMap<string, string>,
): { wirePlain: string; mentionUserIds: string[] } {
  const wirePlain = replaceDisplayNameMentionsWithMxids(
    composerPlain,
    sanitizedLabelToUserId,
  );
  const mentionUserIds = extractMentionUserIdsFromPlainBody(wirePlain);
  return { wirePlain, mentionUserIds };
}
