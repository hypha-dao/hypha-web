import { eq, inArray } from 'drizzle-orm';
import { matrixUserLinks, people } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import {
  applyMentionLabels,
  extractMentionUserIdsFromPlainBody,
  formatMentionLabel,
} from './mention-labels';

/**
 * Replaces `@user:homeserver` tokens in a message body with the mentioned people's names.
 *
 * Presentation only, so it must never cost anyone the notification: `ingestParsedMessage` claims the
 * event before `dispatch()` runs and does not retry a failed dispatch, so a rejected lookup here
 * would silently drop the message for every recipient. On any failure the raw body is returned.
 */
export async function humanizeMessageBody(
  body: string,
  { db }: DbConfig,
): Promise<string> {
  const matrixUserIds = extractMentionUserIdsFromPlainBody(body);
  if (matrixUserIds.length === 0) return body;

  try {
    const rows = await db
      .select({
        matrixUserId: matrixUserLinks.matrixUserId,
        name: people.name,
        surname: people.surname,
      })
      .from(matrixUserLinks)
      .innerJoin(people, eq(matrixUserLinks.privyUserId, people.sub))
      .where(inArray(matrixUserLinks.matrixUserId, matrixUserIds));

    const labels = new Map<string, string>();
    for (const row of rows) {
      const label = formatMentionLabel(row.name, row.surname);
      if (label) labels.set(row.matrixUserId, label);
    }
    return applyMentionLabels(body, labels);
  } catch (error) {
    console.warn(
      '[notifications] chat: could not resolve mention names — using the raw message text',
      error,
    );
    return body;
  }
}
