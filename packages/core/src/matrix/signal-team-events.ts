export const SIGNAL_TEAM_EVENT_BODY_MARKER = '[hypha:signal-team]';

function normalizeMatrixUserIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function formatMatrixUserIdForPlainText(userId: string): string {
  const trimmed = userId.trim();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

/** User-facing notice text with full MXIDs so mention pills can resolve Hypha names. */
export function formatSignalTeamUpdateDisplayBody(
  addedMemberMatrixUserIds: string[],
  removedMemberMatrixUserIds: string[],
): string {
  const added = normalizeMatrixUserIds(addedMemberMatrixUserIds).map(
    formatMatrixUserIdForPlainText,
  );
  const removed = normalizeMatrixUserIds(removedMemberMatrixUserIds).map(
    formatMatrixUserIdForPlainText,
  );
  const summaryParts: string[] = [];
  if (added.length > 0) {
    summaryParts.push(`added ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    summaryParts.push(`removed ${removed.join(', ')}`);
  }
  const summaryText =
    summaryParts.length > 0 ? `: ${summaryParts.join('; ')}` : '';
  return `signal team updated${summaryText}`;
}

export function parseSignalTeamMemberChangesFromWireContent(
  content: Record<string, unknown>,
  body: string,
): { added: string[]; removed: string[] } | null {
  if (!body.includes(SIGNAL_TEAM_EVENT_BODY_MARKER)) return null;
  const added = normalizeMatrixUserIds(content.addedMemberMatrixUserIds);
  const removed = normalizeMatrixUserIds(content.removedMemberMatrixUserIds);
  if (added.length === 0 && removed.length === 0) return null;
  return { added, removed };
}

export function resolveSignalTeamUpdateDisplayBody(
  content: Record<string, unknown>,
  body: string,
): string | null {
  const changes = parseSignalTeamMemberChangesFromWireContent(content, body);
  if (!changes) return null;
  return formatSignalTeamUpdateDisplayBody(changes.added, changes.removed);
}
